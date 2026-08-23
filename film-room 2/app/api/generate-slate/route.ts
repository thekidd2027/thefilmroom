import { NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { searchRecentVideos, getVideoStats, YouTubeSearchResult, VideoStats } from "@/lib/youtube";
import { researchTodaysStories, scoreVideoCandidates, buildGroundedRecipe, TrendStory, SourceInspection } from "@/lib/openai";
import { scoreCandidate } from "@/lib/scoring";
import { buildChecklist } from "@/lib/checklist";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTranscript, inspectVideo } from "@/lib/supadata";

export const maxDuration = 300;

type StoryEval = {
  story: TrendStory;
  sources: { search: YouTubeSearchResult; stats: VideoStats; score: number; rightsReason: string }[];
  score: number;
};

export async function POST() {
  try {
    if (!process.env.SUPADATA_API_KEY) {
      return NextResponse.json({ error: "SUPADATA_API_KEY is required for grounded timestamps and visual inspection." }, { status: 400 });
    }
    const b = await getBrandBrain();
    const db = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    // Regeneration replaces only uncommitted proposals; claimed/submitted/published work is never deleted.
    await db.from("reels").delete().eq("slate_date", today).in("status", ["proposed", "rejected"]);

    const trendStories = (await researchTodaysStories(b, today)).slice(0, 10);
    if (!trendStories.length) return NextResponse.json({ error: "Trend research returned no stories." }, { status: 200 });

    const { data: recentReels } = await db.from("reels").select("headline").gte("slate_date", new Date(Date.now()-14*86400000).toISOString().slice(0,10));
    const recentHeadlines = (recentReels ?? []).map((x:any)=>x.headline);

    const storyEvals: StoryEval[] = [];
    for (const story of trendStories.slice(0, 7)) {
      const queries = (story.searchQueries?.length ? story.searchQueries : [story.headline]).slice(0,2);
      const nested = await Promise.all(queries.map(q => searchRecentVideos(q, { maxResults: 6 })));
      const uniq = [...new Map(nested.flat().map(x=>[x.videoId,x])).values()].slice(0,10);
      if (!uniq.length) continue;
      const stats = await getVideoStats(uniq.map(x=>x.videoId));
      const statsMap = new Map(stats.map(x=>[x.videoId,x]));
      const items = uniq.filter(x=>statsMap.has(x.videoId)).map(search=>({search, stats:statsMap.get(search.videoId)!}));
      const qualitative = await scoreVideoCandidates(b, story, items);
      const ranked = items.map((item, i) => {
        const q = qualitative[i] ?? { headline:story.headline, sport:story.sport, summary:story.summary, wowFactor:7, storyValue:7, brandFit:7, verticalViability:6, rightsRisk:"caution" as const, rightsReason:"Not enough evidence to confirm reuse rights." };
        const result = scoreCandidate(b, q, item.stats, item.search.publishedAt, recentHeadlines);
        return { ...item, score: result.total, rightsReason:q.rightsReason, blocked:result.blocked };
      }).filter(x=>!x.blocked).sort((a,b)=>b.score-a.score);
      if (!ranked.length) continue;
      const trendBoost = Math.min(1.2, (story.popularityEvidence?.length ?? 0) * 0.2);
      storyEvals.push({
        story,
        sources: ranked.slice(0,6).map(x=>({search:x.search, stats:x.stats, score:x.score, rightsReason:x.rightsReason})),
        score: Math.min(10, ranked[0].score + trendBoost),
      });
    }

    const selected = storyEvals.sort((a,b)=>b.score-a.score).slice(0,b.slateSize);
    if (!selected.length) return NextResponse.json({ error:"No usable stories after source discovery." }, { status:200 });

    const insertedReels:any[] = [];
    for (let slot=0; slot<selected.length; slot++) {
      const entry = selected[slot];
      const candidateRows = entry.sources.map(src=>({
        slate_date:today, headline:entry.story.headline, sport:entry.story.sport, summary:entry.story.summary,
        source_urls:[`https://www.youtube.com/watch?v=${src.search.videoId}`], youtube_video_id:src.search.videoId,
        youtube_channel_id:src.search.channelId, youtube_channel_title:src.search.channelTitle,
        view_count:src.stats.viewCount, published_at:src.search.publishedAt, score:src.score,
        score_breakdown:{ source_score:src.score, trend_evidence:entry.story.popularityEvidence }, selected:false,
        rejection_reason:null,
      }));
      const { data:cands } = await db.from("candidates").insert(candidateRows).select();
      const primaryCandidateId = cands?.[0]?.id ?? null;

      // Ground timestamps. Prefer short/medium videos because they can also be visually inspected.
      const sourceInspections:SourceInspection[] = [];
      for (const src of entry.sources.slice(0,4)) {
        let transcript:any[] = [];
        let visuals:any[] = [];
        try { transcript = await getTranscript(`https://www.youtube.com/watch?v=${src.search.videoId}`); } catch (e) { console.warn("Transcript failed", src.search.videoId, e); }
        if (src.stats.durationSeconds > 0 && src.stats.durationSeconds <= 1800) {
          try { visuals = await inspectVideo(`https://www.youtube.com/watch?v=${src.search.videoId}`); } catch (e) { console.warn("Visual inspect failed", src.search.videoId, e); }
        }
        if (transcript.length || visuals.length) sourceInspections.push({ search:src.search, stats:src.stats, transcript, visuals });
      }
      if (!sourceInspections.length) continue; // never invent timestamps

      const recipe = await buildGroundedRecipe(b, entry.story, sourceInspections);
      if (!recipe.primary_clips.length) continue;
      const checklist = buildChecklist(b, recipe.edit_notes);

      const row = {
        slate_date:today, slot:slot+1, candidate_id:primaryCandidateId, status:"proposed",
        headline:entry.story.headline, sport:entry.story.sport, predicted_interest:entry.score,
        script:"", caption:recipe.caption, cover_text:recipe.cover_text,
        edit_notes:recipe.edit_notes, music_options:recipe.music_options,
        clip_primary:recipe.primary_clips[0], clip_backups:recipe.replacement_clips,
        primary_clips:recipe.primary_clips, story_research:recipe.story_research,
        template_name:recipe.template_name, checklist,
      };
      const { data:inserted, error } = await db.from("reels").insert(row).select().single();
      if (error) throw error;
      if (primaryCandidateId) await db.from("candidates").update({selected:true}).eq("id", primaryCandidateId);
      insertedReels.push(inserted);
    }

    return NextResponse.json({ reels:insertedReels, researched:trendStories.length });
  } catch (err:any) {
    console.error(err);
    return NextResponse.json({ error:err?.message ?? "Generation failed" }, { status:500 });
  }
}
