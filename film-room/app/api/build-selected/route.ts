import { NextRequest, NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { searchRecentVideos, getVideoStats, YouTubeSearchResult, VideoStats } from "@/lib/youtube";
import { scoreVideoCandidates, buildGroundedRecipe, TrendStory, SourceInspection } from "@/lib/openai";
import { scoreCandidate } from "@/lib/scoring";
import { buildChecklist } from "@/lib/checklist";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTranscript, inspectVideo } from "@/lib/supadata";

export const maxDuration = 300;

type StoryEvalSource = {
  search: YouTubeSearchResult;
  stats: VideoStats;
  score: number;
  rightsReason: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPADATA_API_KEY) {
      return NextResponse.json({ error: "SUPADATA_API_KEY is required." }, { status: 400 });
    }
    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY is required." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean).slice(0, 3) : [];
    if (ids.length !== 3) {
      return NextResponse.json({ error: "Select exactly 3 pitches." }, { status: 400 });
    }

    const brain = await getBrandBrain();
    const db = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const { data: pitches, error: pitchError } = await db
      .from("candidates")
      .select("*")
      .in("id", ids)
      .eq("candidate_kind", "pitch");
    if (pitchError) throw pitchError;
    if (!pitches || pitches.length !== 3) {
      return NextResponse.json({ error: "One or more selected pitches no longer exist." }, { status: 400 });
    }

    const { data: recentReels } = await db
      .from("reels")
      .select("headline")
      .gte("slate_date", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));
    const recentHeadlines = (recentReels ?? []).map((x: any) => x.headline);

    // Replace only untouched proposals for today.
    await db.from("reels").delete().eq("slate_date", today).in("status", ["proposed", "rejected"]);

    const built: any[] = [];

    for (let slot = 0; slot < pitches.length; slot++) {
      const pitch = pitches[slot];
      const story = (pitch.score_breakdown?.story ?? {
        headline: pitch.headline,
        sport: pitch.sport,
        summary: pitch.summary ?? "",
        whyToday: pitch.score_breakdown?.why_today ?? "Selected Film Room pitch.",
        viewerFeeling: pitch.score_breakdown?.viewer_feeling ?? "interest and nostalgia",
        searchQueries: [pitch.headline],
        popularityEvidence: [],
        trendSources: [],
        template: pitch.score_breakdown?.template ?? "STORY",
        fanAllegianceLogic: pitch.score_breakdown?.fan_allegiance_logic ?? "Keep fan allegiance coherent.",
      }) as TrendStory;

      const queries = (story.searchQueries?.length ? story.searchQueries : [story.headline]).slice(0, 3);
      const nested = await Promise.all(queries.map((q) => searchRecentVideos(q, { maxResults: 7 })));
      const uniq = [...new Map(nested.flat().map((x) => [x.videoId, x])).values()].slice(0, 12);
      if (!uniq.length) continue;

      const stats = await getVideoStats(uniq.map((x) => x.videoId));
      const statsMap = new Map(stats.map((x) => [x.videoId, x]));
      const items = uniq
        .filter((x) => statsMap.has(x.videoId))
        .map((search) => ({ search, stats: statsMap.get(search.videoId)! }));

      const qualitative = await scoreVideoCandidates(brain, story, items);
      const ranked = items
        .map((item, i) => {
          const q = qualitative[i] ?? {
            headline: story.headline,
            sport: story.sport,
            summary: story.summary,
            wowFactor: 7,
            storyValue: 7,
            brandFit: 7,
            verticalViability: 6,
            rightsRisk: "caution" as const,
            rightsReason: "Not enough evidence to confirm reuse rights.",
          };
          const result = scoreCandidate(brain, q, item.stats, item.search.publishedAt, recentHeadlines);
          return { ...item, score: result.total, rightsReason: q.rightsReason, blocked: result.blocked };
        })
        .filter((x) => !x.blocked)
        .sort((a, b) => b.score - a.score);

      if (!ranked.length) continue;

      const sources: StoryEvalSource[] = ranked.slice(0, 6).map((x) => ({
        search: x.search,
        stats: x.stats,
        score: x.score,
        rightsReason: x.rightsReason,
      }));

      const sourceRows = sources.map((src) => ({
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
        score_breakdown: { source_score: src.score, trend_evidence: story.popularityEvidence },
        selected: false,
        rejection_reason: null,
      }));

      const { data: sourceCandidates, error: sourceError } = await db.from("candidates").insert(sourceRows).select();
      if (sourceError) throw sourceError;
      const primaryCandidateId = sourceCandidates?.[0]?.id ?? null;

      const sourceInspections: SourceInspection[] = [];
      for (const src of sources.slice(0, 4)) {
        let transcript: any[] = [];
        let visuals: any[] = [];
        try {
          transcript = await getTranscript(`https://www.youtube.com/watch?v=${src.search.videoId}`);
        } catch (e) {
          console.warn("Transcript failed", src.search.videoId, e);
        }
        if (src.stats.durationSeconds > 0 && src.stats.durationSeconds <= 1800) {
          try {
            visuals = await inspectVideo(`https://www.youtube.com/watch?v=${src.search.videoId}`);
          } catch (e) {
            console.warn("Visual inspect failed", src.search.videoId, e);
          }
        }
        if (transcript.length || visuals.length) {
          sourceInspections.push({ search: src.search, stats: src.stats, transcript, visuals });
        }
      }

      if (!sourceInspections.length) continue;

      const recipe = await buildGroundedRecipe(brain, story, sourceInspections);
      if (!recipe.primary_clips.length) continue;

      const checklist = buildChecklist(brain, recipe.edit_notes);
      const predictedInterest = Math.min(10, ranked[0].score + Math.min(1.2, (story.popularityEvidence?.length ?? 0) * 0.2));

      const reelRow = {
        slate_date: today,
        slot: slot + 1,
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
        clip_backups: recipe.replacement_clips,
        primary_clips: recipe.primary_clips,
        story_research: recipe.story_research,
        template_name: recipe.template_name,
        checklist,
      };

      const { data: inserted, error: reelError } = await db.from("reels").insert(reelRow).select().single();
      if (reelError) throw reelError;

      if (primaryCandidateId) {
        await db.from("candidates").update({ selected: true }).eq("id", primaryCandidateId);
      }
      await db.from("candidates").update({ selected: true }).eq("id", pitch.id);
      built.push(inserted);
    }

    if (!built.length) {
      return NextResponse.json({ error: "The selected pitches did not produce grounded edit recipes. Try different pitches." }, { status: 422 });
    }

    return NextResponse.json({ reels: built, count: built.length });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? "Build failed" }, { status: 500 });
  }
}
