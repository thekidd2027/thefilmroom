import { NextRequest, NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { searchRecentVideos, getVideoStats } from "@/lib/youtube";
import { scoreVideoCandidates, buildGroundedRecipe, TrendStory, SourceInspection } from "@/lib/openai";
import { scoreCandidate } from "@/lib/scoring";
import { buildChecklist } from "@/lib/checklist";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getTranscript, inspectVideo } from "@/lib/supadata";
import { requireOwner } from "@/lib/requireOwner";

export const maxDuration = 180;

export async function POST(req: NextRequest) {
  try {
    await requireOwner();
    if (!process.env.SUPADATA_API_KEY) return NextResponse.json({ error:"SUPADATA_API_KEY is required." }, { status:400 });
    if (!process.env.YOUTUBE_API_KEY) return NextResponse.json({ error:"YOUTUBE_API_KEY is required." }, { status:400 });

    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    const slot = Math.min(3, Math.max(1, Number(body.slot ?? 1)));
    if (!id) return NextResponse.json({ error:"Pitch id is required." }, { status:400 });

    const db = supabaseAdmin();
    const brain = await getBrandBrain();
    const today = new Date().toISOString().slice(0,10);
    const { data:pitch, error:pitchError } = await db.from("candidates").select("*").eq("id",id).eq("candidate_kind","pitch").maybeSingle();
    if (pitchError) throw pitchError;
    if (!pitch) return NextResponse.json({ error:"That pitch no longer exists." }, { status:404 });

    const story = (pitch.score_breakdown?.story ?? {
      headline:pitch.headline, sport:pitch.sport, summary:pitch.summary ?? "", whyToday:pitch.score_breakdown?.why_today ?? "Selected Film Room pitch.", viewerFeeling:pitch.score_breakdown?.viewer_feeling ?? "interest and nostalgia", searchQueries:[pitch.headline], popularityEvidence:[], trendSources:[], template:pitch.score_breakdown?.template ?? "STORY", fanAllegianceLogic:pitch.score_breakdown?.fan_allegiance_logic ?? "Keep fan allegiance coherent."
    }) as TrendStory;

    const { data:recentReels } = await db.from("reels").select("headline").gte("slate_date",new Date(Date.now()-14*86400000).toISOString().slice(0,10));
    const recentHeadlines = (recentReels ?? []).map((x:any)=>x.headline);
    const queries = (story.searchQueries?.length ? story.searchQueries : [story.headline]).slice(0,2);
    const nested = await Promise.all(queries.map(q=>searchRecentVideos(q,{maxResults:5})));
    const uniq = [...new Map(nested.flat().map(x=>[x.videoId,x])).values()].slice(0,8);
    if (!uniq.length) return NextResponse.json({ error:"No YouTube sources found for this pitch. Pick another pitch." }, { status:422 });

    const stats = await getVideoStats(uniq.map(x=>x.videoId));
    const statsMap = new Map(stats.map(x=>[x.videoId,x]));
    const items = uniq.filter(x=>statsMap.has(x.videoId)).map(search=>({search,stats:statsMap.get(search.videoId)!}));
    if (!items.length) return NextResponse.json({ error:"Source videos were found but their metadata was unavailable." }, { status:422 });

    let qualitative:any[] = [];
    try { qualitative = await scoreVideoCandidates(brain,story,items); } catch (e) { console.warn("Claude source scoring failed; using deterministic scoring.",e); }
    const ranked = items.map((item,i)=>{
      const q = qualitative[i] ?? { headline:story.headline,sport:story.sport,summary:story.summary,wowFactor:7,storyValue:8,brandFit:8,verticalViability:7,rightsRisk:"caution" as const,rightsReason:"Public source footage; verify platform reuse rights." };
      const result = scoreCandidate(brain,q,item.stats,item.search.publishedAt,recentHeadlines);
      return {...item,score:result.total,rightsReason:q.rightsReason,blocked:result.blocked};
    }).filter(x=>!x.blocked).sort((a,b)=>b.score-a.score);
    if (!ranked.length) return NextResponse.json({ error:"All discovered sources were blocked by sourcing rules." }, { status:422 });

    // Spend Supadata credits only on the strongest two sources first.
    const inspected:SourceInspection[] = [];
    for (const src of ranked.slice(0,2)) {
      let transcript:any[]=[]; let visuals:any[]=[];
      try { transcript = await getTranscript(`https://www.youtube.com/watch?v=${src.search.videoId}`); } catch(e){ console.warn("Transcript failed",src.search.videoId,e); }
      if (src.stats.durationSeconds > 0 && src.stats.durationSeconds <= 1200) {
        try { visuals = await inspectVideo(`https://www.youtube.com/watch?v=${src.search.videoId}`); } catch(e){ console.warn("Visual inspection failed",src.search.videoId,e); }
      }
      if (transcript.length || visuals.length) inspected.push({search:src.search,stats:src.stats,transcript,visuals});
    }
    if (!inspected.length) return NextResponse.json({ error:"Could not ground timestamps from the best sources. Pick another pitch or try again later." }, { status:422 });

    const recipe = await buildGroundedRecipe(brain,story,inspected);
    if (!recipe.primary_clips?.length) return NextResponse.json({ error:"The Brain could not produce grounded clips for this pitch." }, { status:422 });

    // Only write source rows after the reel recipe succeeds, preventing junk rows on failed attempts.
    const sourceRows = ranked.slice(0,4).map(src=>({
      slate_date:today,candidate_kind:"source",headline:story.headline,sport:story.sport,summary:story.summary,source_urls:[`https://www.youtube.com/watch?v=${src.search.videoId}`],youtube_video_id:src.search.videoId,youtube_channel_id:src.search.channelId,youtube_channel_title:src.search.channelTitle,view_count:src.stats.viewCount,published_at:src.search.publishedAt,score:src.score,score_breakdown:{source_score:src.score,trend_evidence:story.popularityEvidence},selected:false,rejection_reason:null,
    }));
    await db.from("candidates").delete().eq("slate_date",today).eq("candidate_kind","source").eq("headline",story.headline);
    const { data:sourceCandidates,error:sourceError } = await db.from("candidates").insert(sourceRows).select();
    if (sourceError) throw sourceError;
    const primaryCandidateId = sourceCandidates?.[0]?.id ?? null;

    const checklist = buildChecklist(brain,recipe.edit_notes);
    const predictedInterest = Math.min(10,ranked[0].score + Math.min(1.2,(story.popularityEvidence?.length ?? 0)*0.2));
    const reelRow = { slate_date:today,slot,candidate_id:primaryCandidateId,status:"proposed",headline:story.headline,sport:story.sport,predicted_interest:predictedInterest,script:"",caption:recipe.caption,cover_text:recipe.cover_text,edit_notes:recipe.edit_notes,music_options:recipe.music_options,clip_primary:recipe.primary_clips[0],clip_backups:recipe.replacement_clips,primary_clips:recipe.primary_clips,story_research:recipe.story_research,template_name:recipe.template_name,checklist };

    await db.from("reels").delete().eq("slate_date",today).eq("slot",slot).in("status",["proposed","rejected"]);
    const { data:inserted,error:reelError } = await db.from("reels").insert(reelRow).select().single();
    if (reelError) throw reelError;
    if (primaryCandidateId) await db.from("candidates").update({selected:true}).eq("id",primaryCandidateId);
    await db.from("candidates").update({selected:true}).eq("id",pitch.id);
    return NextResponse.json({ reel:inserted });
  } catch(err:any) {
    console.error("Build-one failed",err);
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error:status===401?"Please sign in again.":status===403?"Owner access required.":err?.message ?? "Build failed" }, { status });
  }
}
