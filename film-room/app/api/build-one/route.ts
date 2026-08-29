import { NextRequest, NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { searchRecentVideos, getVideoStats } from "@/lib/youtube";
import { scoreVideoCandidates, buildGroundedRecipe, TrendStory, SourceInspection } from "@/lib/openai";
import { scoreCandidate } from "@/lib/scoring";
import { buildChecklist } from "@/lib/checklist";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTranscript, inspectVideo, parseManualTranscript } from "@/lib/supadata";
import { requireOwner } from "@/lib/requireOwner";

export const maxDuration = 180;

function storyNeedsTranscript(story: any) {
  const template = String(story?.template ?? "").toUpperCase();
  const opening = String(story?.openingConcept ?? story?.opening_concept ?? "").toLowerCase();
  const summary = String(story?.summary ?? "").toLowerCase();
  return template === "STORY" || /interview|documentary|podcast|quote|soundbite|press conference|player says|coach says/.test(`${opening} ${summary}`);
}

function looksLikeDerivativeSocialEdit(item: any, stats?: any) {
  const text = `${item?.title ?? ""} ${item?.description ?? ""}`.toLowerCase();
  if (/#shorts?\b|\bshorts?\b|\breel\b|\btiktok\b|\bfan edit\b|\bedit audio\b|\bamv\b|\bmixtape\b|\bcompilation\b/.test(text)) return true;

  const channel = String(item?.channelTitle ?? "").toLowerCase();
  const officialish = /espn|abc|cbs sports|fox sports|nbc sports|network|ncaa|conference|athletics|university|college|sec|acc|big ten|big 12|pac-12|march madness/.test(channel);
  const shortCreatorVideo = !officialish && Number(stats?.durationSeconds ?? 0) > 0 && Number(stats?.durationSeconds ?? 0) <= 90;
  return shortCreatorVideo && /highlight|best plays|top plays|edit|viral/.test(text);
}

function sourceAuthority(item: any) {
  const channel = String(item?.channelTitle ?? "").toLowerCase();
  if (/espn|abc|cbs sports|fox sports|nbc sports|big ten network|sec network|acc digital network|ncaa|march madness/.test(channel)) return 4;
  if (/athletics|university|college|conference|big 12|pac-12|football|basketball/.test(channel)) return 2;
  return 0;
}

function storyMatch(item: any, story: any) {
  const hay = `${item?.title ?? ""} ${item?.description ?? ""}`.toLowerCase();
  const entities = [
    ...(Array.isArray(story?.players) ? story.players : []),
    ...(Array.isArray(story?.teams) ? story.teams : []),
    String(story?.year ?? ""),
  ]
    .map((x: any) => String(x).trim().toLowerCase())
    .filter((x: string) => x && x !== "—");

  let score = 0;
  for (const entity of entities) if (hay.includes(entity)) score += 2;

  const usefulWords = String(story?.headline ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word: string) => word.length >= 5 && !["highlights", "football", "basketball", "college"].includes(word));

  for (const word of usefulWords) if (hay.includes(word)) score += 0.4;
  return score;
}

function scopedQueries(story: any, transcriptRequired: boolean) {
  const player = Array.isArray(story?.players) ? String(story.players[0] ?? "") : "";
  const teams = Array.isArray(story?.teams) ? story.teams.map(String).filter(Boolean).join(" vs ") : "";
  const year = String(story?.year ?? "").replace("—", "").trim();
  const subject = [player || teams, year].filter(Boolean).join(" ");

  if (transcriptRequired) {
    return [
      `${story.headline} interview`,
      `${subject} interview press conference`,
      `${player || teams} documentary interview`,
    ];
  }

  return [
    `${story.headline} broadcast`,
    `${story.headline} full highlights announcer`,
    `${subject} broadcast highlights`,
    `${subject} ESPN highlights`,
    `${teams} ${year} full game highlights`,
  ];
}

export async function POST(req: NextRequest) {
  try {
    await requireOwner();
    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY is required." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    const slot = Math.min(3, Math.max(1, Number(body.slot ?? 1)));
    const manualTranscriptText = String(body.manualTranscript ?? "").trim();
    const manualVideoId = String(body.manualVideoId ?? "").trim();
    const manualChunks = manualTranscriptText ? parseManualTranscript(manualTranscriptText) : [];

    if (!id) return NextResponse.json({ error: "Pitch id is required." }, { status: 400 });
    if (manualTranscriptText && manualChunks.length < 2) {
      return NextResponse.json({
        error: "The manual transcript needs timestamps on separate lines, for example: 00:12 Announcer says...",
        needs_manual_transcript: true,
      }, { status: 422 });
    }

    const db = supabaseAdmin();
    const brain = await getBrandBrain();
    const today = new Date().toISOString().slice(0, 10);

    const { data: pitch, error: pitchError } = await db
      .from("candidates")
      .select("*")
      .eq("id", id)
      .eq("candidate_kind", "pitch")
      .maybeSingle();

    if (pitchError) throw pitchError;
    if (!pitch) {
      return NextResponse.json({ error: "That pitch no longer exists. Refresh the pitch board and try again." }, { status: 404 });
    }

    const story = (pitch.score_breakdown?.story ?? {
      headline: pitch.headline,
      sport: pitch.sport,
      summary: pitch.summary ?? "",
      whyToday: pitch.score_breakdown?.why_today ?? "Selected Film Room pitch.",
      viewerFeeling: pitch.score_breakdown?.viewer_feeling ?? "interest and nostalgia",
      searchQueries: [pitch.headline],
      popularityEvidence: [],
      trendSources: [],
      template: pitch.score_breakdown?.template ?? "MOMENT_GAME",
      fanAllegianceLogic: pitch.score_breakdown?.fan_allegiance_logic ?? "Keep the subject coherent.",
      teams: pitch.score_breakdown?.teams ?? [],
      players: pitch.score_breakdown?.players ?? [],
      year: pitch.score_breakdown?.year ?? "",
    }) as TrendStory & Record<string, any>;

    const transcriptRequired = storyNeedsTranscript(story);
    if (transcriptRequired && !manualChunks.length && !process.env.SUPADATA_API_KEY) {
      return NextResponse.json({
        error: "This Story reel needs a grounded interview transcript. Add SUPADATA_API_KEY or provide a timestamped transcript.",
      }, { status: 400 });
    }

    const { data: recentReels } = await db
      .from("reels")
      .select("headline")
      .gte("slate_date", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));
    const recentHeadlines = (recentReels ?? []).map((x: any) => x.headline);

    const queries = Array.from(new Set([
      ...scopedQueries(story, transcriptRequired),
      ...(story.searchQueries ?? []),
    ].filter(Boolean))).slice(0, 5);

    const nested = await Promise.all(
      queries.map((query: string) =>
        searchRecentVideos(query, { maxResults: 10 }).catch((error) => {
          console.warn("YouTube query failed", query, error);
          return [];
        })
      )
    );

    const raw = [...new Map(nested.flat().map((x: any) => [x.videoId, x])).values()].slice(0, 35) as any[];
    if (!raw.length) {
      return NextResponse.json({ error: "I couldn't find a usable YouTube source for this pitch." }, { status: 422 });
    }

    const stats = await getVideoStats(raw.map((x: any) => x.videoId));
    const statsMap = new Map(stats.map((x: any) => [x.videoId, x]));

    const items = raw
      .filter((search: any) => {
        const stat = statsMap.get(search.videoId);
        return stat && !looksLikeDerivativeSocialEdit(search, stat);
      })
      .map((search: any) => ({ search, stats: statsMap.get(search.videoId)! }))
      .sort((a: any, b: any) => {
        const aScore = sourceAuthority(a.search) * 2 + storyMatch(a.search, story);
        const bScore = sourceAuthority(b.search) * 2 + storyMatch(b.search, story);
        return bScore - aScore;
      })
      .slice(0, 15);

    if (!items.length) {
      return NextResponse.json({
        error: "YouTube results were mostly Shorts, creator edits, or weakly related sources. Try another pitch.",
      }, { status: 422 });
    }

    let qualitative: any[] = [];
    try {
      qualitative = await scoreVideoCandidates(brain, story, items);
    } catch (error) {
      console.warn("Claude source scoring failed; using deterministic source scoring.", error);
    }

    const ranked = items
      .map((item: any, index: number) => {
        const q = qualitative[index] ?? {
          headline: story.headline,
          sport: story.sport,
          summary: story.summary,
          wowFactor: 7,
          storyValue: 8,
          brandFit: 8,
          verticalViability: 7,
          rightsRisk: "caution" as const,
          rightsReason: "Broadcast/official highlight source; verify reuse rights.",
        };
        const result = scoreCandidate(brain, q, item.stats, item.search.publishedAt, recentHeadlines);
        const authorityBoost = sourceAuthority(item.search) * 0.65;
        const relevanceBoost = Math.min(2, storyMatch(item.search, story) * 0.25);
        return {
          ...item,
          score: result.total + authorityBoost + relevanceBoost,
          rightsReason: q.rightsReason,
          blocked: result.blocked || q.rightsRisk === "blocked",
        };
      })
      .filter((x: any) => !x.blocked)
      .sort((a: any, b: any) => b.score - a.score);

    if (!ranked.length) {
      return NextResponse.json({
        error: "Sources were found, but none passed the Film Room relevance and sourcing rules.",
      }, { status: 422 });
    }

    const inspectionPool = [...ranked]
      .sort((a: any, b: any) => {
        if (manualVideoId) {
          if (a.search.videoId === manualVideoId) return -1;
          if (b.search.videoId === manualVideoId) return 1;
        }
        const aReasonable = a.stats.durationSeconds >= 45 && a.stats.durationSeconds <= 1800 ? 1 : 0;
        const bReasonable = b.stats.durationSeconds >= 45 && b.stats.durationSeconds <= 1800 ? 1 : 0;
        return bReasonable - aReasonable || b.score - a.score;
      })
      .slice(0, 5);

    const inspected: SourceInspection[] = [];

    if (manualChunks.length) {
      const src = inspectionPool.find((x: any) => x.search.videoId === manualVideoId) ?? inspectionPool[0];
      if (!src) {
        return NextResponse.json({ error: "I couldn't match the manual transcript to a source video." }, { status: 422 });
      }
      let visuals: any[] = [];
      if (process.env.SUPADATA_API_KEY && src.stats.durationSeconds <= 1800) {
        try {
          visuals = await inspectVideo(`https://www.youtube.com/watch?v=${src.search.videoId}`);
        } catch (error) {
          console.warn("Visual inspection failed", src.search.videoId, error);
        }
      }
      inspected.push({ search: src.search, stats: src.stats, transcript: manualChunks, visuals });
    }

    if (process.env.SUPADATA_API_KEY) {
      for (const src of inspectionPool) {
        if (inspected.length >= 4) break;
        if (inspected.some((x) => x.search.videoId === src.search.videoId)) continue;

        const url = `https://www.youtube.com/watch?v=${src.search.videoId}`;
        let transcript: any[] = [];
        let visuals: any[] = [];

        try {
          transcript = await getTranscript(url);
        } catch (error) {
          console.warn("Transcript failed", src.search.videoId, error);
        }

        if (src.stats.durationSeconds > 0 && src.stats.durationSeconds <= 1800) {
          try {
            visuals = await inspectVideo(url);
          } catch (error) {
            console.warn("Visual inspection failed", src.search.videoId, error);
          }
        }

        if (transcript.length || visuals.length) {
          inspected.push({ search: src.search, stats: src.stats, transcript, visuals });
        }
      }
    }

    if (transcriptRequired && !inspected.some((source) => source.transcript.length > 0)) {
      const helpSource = inspectionPool[0];
      return NextResponse.json({
        error: "This Story reel needs spoken-dialogue grounding, but Film Room could not read a transcript. Paste a timestamped transcript to continue.",
        needs_manual_transcript: true,
        manual_source: helpSource ? {
          video_id: helpSource.search.videoId,
          title: helpSource.search.title,
          channel_title: helpSource.search.channelTitle,
          url: `https://www.youtube.com/watch?v=${helpSource.search.videoId}`,
        } : null,
      }, { status: 422 });
    }

    if (!transcriptRequired && !inspected.length) {
      return NextResponse.json({
        error: "I found candidate broadcast videos, but couldn't inspect one well enough to give you trustworthy timestamps. Try another pitch or source.",
      }, { status: 422 });
    }

    const recipe = await buildGroundedRecipe(brain, story, inspected);
    if (!recipe.primary_clips?.length) {
      return NextResponse.json({
        error: "The Brain found footage but couldn't ground a simple watchable timestamp sequence. Try another pitch.",
      }, { status: 422 });
    }

    const selectedVideoId = recipe.primary_clips[0].video_id;
    const selectedRanked = ranked.find((src: any) => src.search.videoId === selectedVideoId) ?? ranked[0];
    const backupRanked = ranked.filter((src: any) => src.search.videoId !== selectedVideoId).slice(0, 2);
    const sourceSet = [selectedRanked, ...backupRanked].filter(Boolean);

    const sourceRows = sourceSet.map((src: any) => ({
      slate_date: today,
      candidate_kind: "source",
      headline: story.headline,
      sport: story.sport,
      summary: story.summary,
      source_urls: [`https://www.youtube.com/watch?v=${src.search.videoId}`],
      youtube_video_id: src.search.videoId,
      youtube_channel_id: src.search.channelId,
      youtube_channel_title: src.search.channelTitle,
      view_count: src.stats.viewCount,
      published_at: src.search.publishedAt,
      score: src.score,
      score_breakdown: {
        source_score: src.score,
        trend_evidence: story.popularityEvidence,
        grounding_mode: transcriptRequired ? "dialogue" : "single_broadcast_source",
        source_authority: sourceAuthority(src.search),
        derivative_social_edit: false,
        primary_source: src.search.videoId === selectedVideoId,
      },
      selected: src.search.videoId === selectedVideoId,
      rejection_reason: null,
    }));

    await db.from("candidates").delete().eq("slate_date", today).eq("candidate_kind", "source").eq("headline", story.headline);
    const { data: sourceCandidates, error: sourceError } = await db.from("candidates").insert(sourceRows).select();
    if (sourceError) throw sourceError;

    const primaryCandidateId = sourceCandidates?.find((x: any) => x.youtube_video_id === selectedVideoId)?.id ?? sourceCandidates?.[0]?.id ?? null;
    const checklist = buildChecklist(brain, recipe.edit_notes);
    const predictedInterest = Math.min(10, selectedRanked.score + Math.min(1.2, (story.popularityEvidence?.length ?? 0) * 0.2));

    const reelRow = {
      slate_date: today,
      slot,
      candidate_id: primaryCandidateId,
      status: "proposed",
      headline: story.headline,
      sport: story.sport,
      predicted_interest: predictedInterest,
      script: "",
      caption: recipe.caption,
      cover_text: recipe.cover_text,
      edit_notes: recipe.edit_notes,
      music_options: recipe.music_options,
      clip_primary: recipe.primary_clips[0],
      clip_backups: [],
      primary_clips: recipe.primary_clips,
      story_research: {
        ...recipe.story_research,
        grounding_mode: transcriptRequired ? "dialogue" : "single_broadcast_source",
        source_video_count: 1,
        primary_source_video_id: selectedVideoId,
        primary_source_title: selectedRanked.search.title,
        primary_source_channel: selectedRanked.search.channelTitle,
      },
      template_name: recipe.template_name,
      checklist,
    };

    await db.from("reels").delete().eq("slate_date", today).eq("slot", slot).in("status", ["proposed", "rejected"]);
    const { data: inserted, error: reelError } = await db.from("reels").insert(reelRow).select().single();
    if (reelError) throw reelError;

    await db.from("candidates").update({ selected: true }).eq("id", pitch.id);

    return NextResponse.json({
      reel: inserted,
      source_count: 1,
      primary_source: {
        video_id: selectedVideoId,
        title: selectedRanked.search.title,
        channel_title: selectedRanked.search.channelTitle,
        url: `https://www.youtube.com/watch?v=${selectedVideoId}`,
      },
      grounding_mode: transcriptRequired ? "dialogue" : "single_broadcast_source",
    });
  } catch (err: any) {
    console.error("Build-one failed", err);
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({
      error: status === 401 ? "Please sign in again." : status === 403 ? "Owner access required." : err?.message ?? "Build failed",
    }, { status });
  }
}
