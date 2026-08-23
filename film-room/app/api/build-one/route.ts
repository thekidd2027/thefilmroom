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
  const text = `${opening} ${summary}`;
  return template === "INTERVIEW_STORY" || /interview|documentary|podcast|quote|soundbite|press conference|player says|coach says/.test(text);
}

export async function POST(req: NextRequest) {
  try {
    await requireOwner();
    if (!process.env.YOUTUBE_API_KEY) return NextResponse.json({ error:"YOUTUBE_API_KEY is required." }, { status:400 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    const slot = Math.min(3, Math.max(1, Number(body.slot ?? 1)));
    const manualTranscriptText = String(body.manualTranscript ?? "").trim();
    const manualVideoId = String(body.manualVideoId ?? "").trim();
    const manualChunks = manualTranscriptText ? parseManualTranscript(manualTranscriptText) : [];
    if (!id) return NextResponse.json({ error:"Pitch id is required." }, { status:400 });
    if (manualTranscriptText && manualChunks.length < 2) {
      return NextResponse.json({ error:"The manual transcript needs timestamps on separate lines, for example: 00:12 Player says...", needs_manual_transcript:true }, { status:422 });
    }

    const db = supabaseAdmin();
    const brain = await getBrandBrain();
    const today = new Date().toISOString().slice(0,10);
    const { data:pitch, error:pitchError } = await db.from("candidates").select("*").eq("id",id).eq("candidate_kind","pitch").maybeSingle();
    if (pitchError) throw pitchError;
    if (!pitch) return NextResponse.json({ error:"That pitch no longer exists. Refresh the pitch board and try again." }, { status:404 });

    const story = (pitch.score_breakdown?.story ?? {
      headline:pitch.headline,
      sport:pitch.sport,
      summary:pitch.summary ?? "",
      whyToday:pitch.score_breakdown?.why_today ?? "Selected Film Room pitch.",
      viewerFeeling:pitch.score_breakdown?.viewer_feeling ?? "interest and nostalgia",
      searchQueries:[pitch.headline],
      popularityEvidence:[],
      trendSources:[],
      template:pitch.score_breakdown?.template ?? "STORY",
      fanAllegianceLogic:pitch.score_breakdown?.fan_allegiance_logic ?? "Keep fan allegiance coherent."
    }) as TrendStory & Record<string, any>;

    const transcriptRequired = storyNeedsTranscript(story);
    if (transcriptRequired && !manualChunks.length && !process.env.SUPADATA_API_KEY) {
      return NextResponse.json({ error:"This story needs dialogue grounding. Add SUPADATA_API_KEY or provide a timestamped transcript." }, { status:400 });
    }

    const { data:recentReels } = await db.from("reels").select("headline").gte("slate_date",new Date(Date.now()-14*86400000).toISOString().slice(0,10));
    const recentHeadlines = (recentReels ?? []).map((x:any)=>x.headline);

    const fallbackQueries = [story.headline, `${story.headline} highlights`, `${story.headline} interview documentary`];
    const queries = Array.from(new Set([...(story.searchQueries ?? []), ...fallbackQueries].filter(Boolean))).slice(0,4);
    const nested = await Promise.all(queries.map((q:string)=>searchRecentVideos(q,{maxResults:8}).catch((e)=>{ console.warn("YouTube query failed",q,e); return []; })));
    const uniq = [...new Map(nested.flat().map((x:any)=>[x.videoId,x])).values()].slice(0,20) as any[];
    if (uniq.length < 2) return NextResponse.json({ error:"I couldn't find at least two usable YouTube sources for this pitch. Try another pitch or generate another angle." }, { status:422 });

    const stats = await getVideoStats(uniq.map((x:any)=>x.videoId));
    const statsMap = new Map(stats.map((x:any)=>[x.videoId,x]));
    const items = uniq.filter((x:any)=>statsMap.has(x.videoId)).map((search:any)=>({search,stats:statsMap.get(search.videoId)!}));
    if (items.length < 2) return NextResponse.json({ error:"YouTube found videos, but fewer than two had readable metadata." }, { status:422 });

    let qualitative:any[] = [];
    try { qualitative = await scoreVideoCandidates(brain,story,items); } catch (e) { console.warn("Claude source scoring failed; using deterministic scoring.",e); }
    const ranked = items.map((item:any,i:number)=>{
      const q = qualitative[i] ?? { headline:story.headline,sport:story.sport,summary:story.summary,wowFactor:7,storyValue:8,brandFit:8,verticalViability:7,rightsRisk:"caution" as const,rightsReason:"Public source footage; verify platform reuse rights." };
      const result = scoreCandidate(brain,q,item.stats,item.search.publishedAt,recentHeadlines);
      return {...item,score:result.total,rightsReason:q.rightsReason,blocked:result.blocked};
    }).filter((x:any)=>!x.blocked).sort((a:any,b:any)=>b.score-a.score);
    if (ranked.length < 2) return NextResponse.json({ error:"Sources were found, but fewer than two passed the Film Room sourcing rules." }, { status:422 });

    const inspectionPool = [...ranked].sort((a:any,b:any)=>{
      if (manualVideoId) {
        if (a.search.videoId === manualVideoId) return -1;
        if (b.search.videoId === manualVideoId) return 1;
      }
      const aGood = a.stats.durationSeconds > 0 && a.stats.durationSeconds <= 1200 ? 1 : 0;
      const bGood = b.stats.durationSeconds > 0 && b.stats.durationSeconds <= 1200 ? 1 : 0;
      return bGood - aGood || b.score - a.score;
    }).slice(0,6);

    const inspected:SourceInspection[] = [];
    if (manualChunks.length) {
      const src = inspectionPool.find((x:any)=>x.search.videoId===manualVideoId) ?? inspectionPool[0];
      if (!src) return NextResponse.json({ error:"I couldn't match the manual transcript to a source video." }, { status:422 });
      const url = `https://www.youtube.com/watch?v=${src.search.videoId}`;
      let visuals:any[]=[];
      if (process.env.SUPADATA_API_KEY && src.stats.durationSeconds > 0 && src.stats.durationSeconds <= 1200) {
        try { visuals = await inspectVideo(url); } catch(e){ console.warn("Manual transcript visual inspection failed",src.search.videoId,e); }
      }
      inspected.push({search:src.search,stats:src.stats,transcript:manualChunks,visuals});
    }

    if (process.env.SUPADATA_API_KEY) {
      for (const src of inspectionPool) {
        if (inspected.length >= 3) break;
        if (inspected.some((x)=>x.search.videoId===src.search.videoId)) continue;
        let transcript:any[]=[]; let visuals:any[]=[];
        const url = `https://www.youtube.com/watch?v=${src.search.videoId}`;
        try { transcript = await getTranscript(url); } catch(e){ console.warn("Transcript failed",src.search.videoId,e); }
        if (src.stats.durationSeconds > 0 && src.stats.durationSeconds <= 1200) {
          try { visuals = await inspectVideo(url); } catch(e){ console.warn("Visual inspection failed",src.search.videoId,e); }
        }
        if (transcript.length || visuals.length) inspected.push({search:src.search,stats:src.stats,transcript,visuals});
      }
    }

    if (transcriptRequired && !inspected.some((source)=>source.transcript.length > 0)) {
      const helpSource = inspectionPool[0];
      return NextResponse.json({
        error:"This story depends on spoken dialogue, but Film Room could not ground a transcript. Paste a timestamped transcript to continue without losing this pitch.",
        needs_manual_transcript:true,
        manual_source: helpSource ? {
          video_id:helpSource.search.videoId,
          title:helpSource.search.title,
          channel_title:helpSource.search.channelTitle,
          url:`https://www.youtube.com/watch?v=${helpSource.search.videoId}`,
        } : null,
      }, { status:422 });
    }

    // Atmosphere/highlight reels do not need dialogue. If automatic inspection is unavailable,
    // keep the best source videos as editor-locate sources instead of failing the reel.
    if (!transcriptRequired) {
      for (const src of inspectionPool) {
        if (inspected.length >= 3) break;
        if (inspected.some((x)=>x.search.videoId===src.search.videoId)) continue;
        inspected.push({ search:src.search, stats:src.stats, transcript:[], visuals:[] });
      }
    }

    if (inspected.length < 2) {
      return NextResponse.json({ error:"Film Room could not assemble at least two source videos for this reel. Try an alternate pitch." }, { status:422 });
    }

    const recipe = await buildGroundedRecipe(brain,story,inspected);
    if (!recipe.primary_clips?.length) return NextResponse.json({ error:"The Brain found sources but couldn't turn them into a usable edit plan. Try an alternate pitch." }, { status:422 });

    const sourceRows = ranked.slice(0,Math.max(4,Math.min(6,ranked.length))).map((src:any)=>({
      slate_date:today,
      candidate_kind:"source",
      headline:story.headline,
      sport:story.sport,
      summary:story.summary,
      source_urls:[`https://www.youtube.com/watch?v=${src.search.videoId}`],
      youtube_video_id:src.search.videoId,
      youtube_channel_id:src.search.channelId,
      youtube_channel_title:src.search.channelTitle,
      view_count:src.stats.viewCount,
      published_at:src.search.publishedAt,
      score:src.score,
      score_breakdown:{source_score:src.score,trend_evidence:story.popularityEvidence,grounding_mode:transcriptRequired?"dialogue":"visual_or_atmosphere"},
      selected:false,
      rejection_reason:null,
    }));
    await db.from("candidates").delete().eq("slate_date",today).eq("candidate_kind","source").eq("headline",story.headline);
    const { data:sourceCandidates,error:sourceError } = await db.from("candidates").insert(sourceRows).select();
    if (sourceError) throw sourceError;
    const primaryCandidateId = sourceCandidates?.[0]?.id ?? null;

    const checklist = buildChecklist(brain,recipe.edit_notes);
    const predictedInterest = Math.min(10,ranked[0].score + Math.min(1.2,(story.popularityEvidence?.length ?? 0)*0.2));
    const reelRow = {
      slate_date:today,
      slot,
      candidate_id:primaryCandidateId,
      status:"proposed",
      headline:story.headline,
      sport:story.sport,
      predicted_interest:predictedInterest,
      script:"",
      caption:recipe.caption,
      cover_text:recipe.cover_text,
      edit_notes:recipe.edit_notes,
      music_options:recipe.music_options,
      clip_primary:recipe.primary_clips[0],
      clip_backups:recipe.replacement_clips,
      primary_clips:recipe.primary_clips,
      story_research:{...recipe.story_research,grounding_mode:transcriptRequired?"dialogue":"visual_or_atmosphere",source_video_count:sourceRows.length},
      template_name:recipe.template_name,
      checklist
    };

    await db.from("reels").delete().eq("slate_date",today).eq("slot",slot).in("status",["proposed","rejected"]);
    const { data:inserted,error:reelError } = await db.from("reels").insert(reelRow).select().single();
    if (reelError) throw reelError;
    if (primaryCandidateId) await db.from("candidates").update({selected:true}).eq("id",primaryCandidateId);
    await db.from("candidates").update({selected:true}).eq("id",pitch.id);
    return NextResponse.json({ reel:inserted, source_count:sourceRows.length, grounding_mode:transcriptRequired?"dialogue":"visual_or_atmosphere" });
  } catch(err:any) {
    console.error("Build-one failed",err);
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error:status===401?"Please sign in again.":status===403?"Owner access required.":err?.message ?? "Build failed" }, { status });
  }
}
