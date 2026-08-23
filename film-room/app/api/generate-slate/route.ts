import { NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/requireOwner";

export const maxDuration = 60;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const PITCH_MODEL = process.env.ANTHROPIC_PITCH_MODEL ?? "claude-haiku-4-5";

type PitchStory = {
  headline: string;
  sport: "football" | "basketball";
  summary: string;
  whyToday: string;
  viewerFeeling: string;
  searchQueries: string[];
  popularityEvidence: string[];
  trendSources: { label: string; url: string }[];
  template: "MOMENT" | "FEELING" | "STORY" | "TAKE";
  fanAllegianceLogic: string;
};

function fallbackPitches(): PitchStory[] {
  return [
    { headline:"The sounds that mean college football is back", sport:"football", summary:"Build an anticipation reel from bands, tunnels, crowd roars, kickoffs and stadium lights.", whyToday:"Late summer is when anticipation becomes the story even before the biggest games arrive.", viewerFeeling:"goosebumps and anticipation", searchQueries:["college football best entrances crowd 4k","college football stadium atmosphere kickoff"], popularityEvidence:["Seasonal anticipation content works without needing breaking news."], trendSources:[], template:"FEELING", fanAllegianceLogic:"Use multiple fanbases only as shared college-football culture; do not make one team a hero and victim." },
    { headline:"The entrances that make college football different", sport:"football", summary:"A fast montage of iconic entrances and traditions that instantly identify the sport.", whyToday:"Traditions are evergreen and especially relevant as football season approaches.", viewerFeeling:"belonging and anticipation", searchQueries:["best college football entrances","college football traditions stadium entrance"], popularityEvidence:["Highly recognizable traditions have durable share value."], trendSources:[], template:"FEELING", fanAllegianceLogic:"Treat every featured school as a hero; avoid rivalry humiliation clips." },
    { headline:"One play that changed a rivalry forever", sport:"football", summary:"Tell one iconic rivalry moment in a tight beginning-middle-payoff structure.", whyToday:"Rivalries are always legible and become more relevant as the season calendar turns toward football.", viewerFeeling:"tension and nostalgia", searchQueries:["iconic college football rivalry game ending","best rivalry moments college football broadcast"], popularityEvidence:["Rivalry moments carry built-in context and fan emotion."], trendSources:[], template:"MOMENT", fanAllegianceLogic:"Conflict is allowed because the rivalry itself is the story." },
    { headline:"When the whole stadium knew what was coming", sport:"football", summary:"Center a famous crowd, chant, entrance or late-game moment where atmosphere becomes the main character.", whyToday:"Atmosphere content is evergreen and visually strong for short-form edits.", viewerFeeling:"awe and nostalgia", searchQueries:["loudest college football stadium moment","college football crowd eruption iconic"], popularityEvidence:["Crowd-reaction footage is culturally recognizable and easy to understand without voiceover."], trendSources:[], template:"MOMENT", fanAllegianceLogic:"Keep the reel emotionally centered on one home crowd." },
    { headline:"The plays every college football fan remembers instantly", sport:"football", summary:"Use three to five universally recognizable moments with minimal text and strong broadcast audio.", whyToday:"A memory-driven reel fills quiet news days while reinforcing the channel identity.", viewerFeeling:"recognition and nostalgia", searchQueries:["most iconic college football plays ever","college football legendary moments broadcast"], popularityEvidence:["Culturally sticky plays outperform obscure athletic highlights."], trendSources:[], template:"FEELING", fanAllegianceLogic:"Choose a neutral mix; do not celebrate and embarrass the same fanbase in one general hype reel." },
    { headline:"The moment a star became a college legend", sport:"football", summary:"Choose one recognizable player and build around the exact sequence that changed how fans remember them.", whyToday:"Player-origin stories are evergreen and give old footage a clear narrative purpose.", viewerFeeling:"admiration and nostalgia", searchQueries:["college football legendary player breakout game","college football iconic player moment broadcast"], popularityEvidence:["Recognizable player arcs provide a strong emotional hook."], trendSources:[], template:"STORY", fanAllegianceLogic:"Stay with one player/team point of view throughout." },
    { headline:"College basketball when the building starts shaking", sport:"basketball", summary:"A pure atmosphere reel built around student sections, late-game runs and arena eruptions.", whyToday:"Basketball atmosphere is evergreen and gives the feed variety when football dominates the calendar.", viewerFeeling:"energy and belonging", searchQueries:["college basketball loudest crowd student section","college basketball arena eruption buzzer"], popularityEvidence:["Crowd energy translates immediately in vertical short-form."], trendSources:[], template:"FEELING", fanAllegianceLogic:"Use a neutral culture montage or stay with one arena; avoid conflicting hero/victim treatment." },
    { headline:"The buzzer beaters that still feel impossible", sport:"basketball", summary:"Build a short sequence of iconic game winners with the broadcast call doing most of the storytelling.", whyToday:"Evergreen basketball history keeps the channel active outside tournament season.", viewerFeeling:"disbelief and nostalgia", searchQueries:["iconic college basketball buzzer beaters broadcast","March Madness greatest game winners"], popularityEvidence:["Buzzer beaters have instant stakes and recognizable visual payoff."], trendSources:[], template:"MOMENT", fanAllegianceLogic:"Use a neutral historic montage; do not repeat the same losing fanbase." },
    { headline:"Why college sports still feels different", sport:"football", summary:"A cinematic thesis reel: bands, parents, students, old stadiums, celebrations and broadcast texture.", whyToday:"This directly expresses Film Room's identity and does not depend on a news cycle.", viewerFeeling:"warmth, belonging and nostalgia", searchQueries:["college football cinematic traditions fans","college sports emotional moments crowd family"], popularityEvidence:["Identity-first evergreen content can become a signature recurring format."], trendSources:[], template:"FEELING", fanAllegianceLogic:"Celebrate the culture broadly; every featured fanbase should feel respected." },
    { headline:"The last time these giants met, everything changed", sport:"football", summary:"Use a famous historical matchup as a compact setup-payoff story that can later be reused when the teams meet again.", whyToday:"Matchup-history pieces are evergreen inventory that becomes even more valuable once schedules and game weeks arrive.", viewerFeeling:"anticipation and historical weight", searchQueries:["classic college football matchup full highlights","historic college football rivalry last meeting"], popularityEvidence:["Historical matchup context is reusable and seasonally valuable."], trendSources:[], template:"STORY", fanAllegianceLogic:"Both sides can appear as hero and victim because the matchup conflict is the subject." },
  ];
}

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Unreadable pitch response");
  }
}

async function generatePitchIdeas(dateIso: string, brain: any): Promise<PitchStory[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fallbackPitches();

  const prompt = `You are the editorial pitch desk for Film Room, a college football and college basketball short-form media brand. Today is ${dateIso}.
Film Room's thesis: make today's college sports feel historic and historic college sports feel alive again.
Core sports: ${(brain?.editorialRules?.coreSports ?? ["college football", "college basketball"]).join(", ")}.
Voice principles: ${(brain?.voice?.principles ?? []).join(" ")}
Season rule: ${brain?.editorialRules?.currentVsFlashback ?? "Use current context when strong, otherwise use seasonally relevant history, rivalries, traditions, player stories and iconic moments."}
Create exactly 10 strong reel ideas. Do not research source videos, timestamps or transcripts yet. Do not invent breaking news. Mix current/seasonal, evergreen, flashback/history and emotional nostalgia. Favor ideas easy to source later from YouTube and usable as 15-30 second edits without voiceover.
Return ONLY valid JSON: {"stories":[{"headline":"...","sport":"football|basketball","summary":"...","whyToday":"...","viewerFeeling":"...","searchQueries":["...","..."],"popularityEvidence":["..."],"trendSources":[],"template":"MOMENT|FEELING|STORY|TAKE","fanAllegianceLogic":"..."}]}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method:"POST",
      headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({ model:PITCH_MODEL, max_tokens:2200, temperature:0.75, messages:[{role:"user",content:prompt}] }),
      signal:controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? `Anthropic request failed (${response.status})`);
    const text = (payload?.content ?? []).filter((b:any)=>b?.type==="text").map((b:any)=>b.text).join("\n");
    const parsed = extractJson(text);
    const stories = Array.isArray(parsed?.stories) ? parsed.stories : [];
    const normalized = stories.filter((s:any)=>s?.headline && (s.sport==="football" || s.sport==="basketball")).slice(0,10).map((s:any)=>({
      headline:String(s.headline), sport:s.sport, summary:String(s.summary ?? ""), whyToday:String(s.whyToday ?? "Seasonally relevant Film Room idea."), viewerFeeling:String(s.viewerFeeling ?? "nostalgia, anticipation, or connection"), searchQueries:Array.isArray(s.searchQueries)&&s.searchQueries.length?s.searchQueries.slice(0,3).map(String):[String(s.headline)], popularityEvidence:Array.isArray(s.popularityEvidence)?s.popularityEvidence.map(String):[], trendSources:[], template:["MOMENT","FEELING","STORY","TAKE"].includes(s.template)?s.template:"STORY", fanAllegianceLogic:String(s.fanAllegianceLogic ?? "Keep one emotional point of view unless rivalry conflict is the story.")
    }));
    return normalized.length >= 6 ? normalized : fallbackPitches();
  } catch (error) {
    console.warn("Pitch AI unavailable; using reliable editorial fallback.", error);
    return fallbackPitches();
  } finally { clearTimeout(timer); }
}

export async function POST() {
  try {
    await requireOwner();
    const brain = await getBrandBrain();
    const db = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const stories = await generatePitchIdeas(today, brain);

    const pitchRows = stories.map((story,index)=>({
      slate_date:today, candidate_kind:"pitch", headline:story.headline, sport:story.sport, summary:story.summary, source_urls:[], score:Math.max(6.5,9.6-index*0.25), score_breakdown:{story,kind:"pitch",why_today:story.whyToday,viewer_feeling:story.viewerFeeling,template:story.template,fan_allegiance_logic:story.fanAllegianceLogic}, selected:false, rejection_reason:null,
    }));

    // Only replace the old board after a complete new board is ready.
    const { error: deleteError } = await db.from("candidates").delete().eq("slate_date",today).eq("candidate_kind","pitch");
    if (deleteError) throw deleteError;
    const { data, error } = await db.from("candidates").insert(pitchRows).select();
    if (error) throw error;
    return NextResponse.json({ pitches:data ?? [], count:data?.length ?? 0 });
  } catch (err:any) {
    console.error("Pitch generation failed:",err);
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error:status===401?"Please sign in again.":status===403?"Owner access required.":err?.message ?? "Pitch generation failed" }, { status });
  }
}
