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
  teams: string[];
  year: string;
  players: string[];
  anticipatedLength: string;
};

function fallbackPitches(): PitchStory[] {
  return [
    {
      headline: "Johnny Football vs. Alabama — the night A&M announced itself",
      sport: "football",
      summary: "Cut the 2012 Texas A&M upset of No. 1 Alabama around Johnny Manziel's chaos, the early lead and the final defensive stand.",
      whyToday: "A recognizable SEC classic gives the channel a strong nostalgic football post even on a quiet news day.",
      viewerFeeling: "disbelief, swagger and nostalgia",
      searchQueries: ["Texas A&M Alabama 2012 Johnny Manziel highlights", "Texas A&M Alabama 2012 final drive broadcast"],
      popularityEvidence: ["Manziel remains one of the most recognizable college football players of the modern era."],
      trendSources: [],
      template: "STORY",
      fanAllegianceLogic: "Tell it from Texas A&M's underdog point of view while respecting Alabama as the giant being challenged.",
      teams: ["Texas A&M", "Alabama"],
      year: "2012",
      players: ["Johnny Manziel", "Mike Evans", "AJ McCarron"],
      anticipatedLength: "22–28 sec",
    },
    {
      headline: "Kick Six — one second that broke Alabama",
      sport: "football",
      summary: "Build the 2013 Iron Bowl ending from the field-goal attempt through Chris Davis crossing the goal line and Jordan-Hare exploding.",
      whyToday: "It is one of the easiest college football moments for casual fans to recognize instantly.",
      viewerFeeling: "shock and pure chaos",
      searchQueries: ["Auburn Alabama Kick Six 2013 broadcast", "Chris Davis Kick Six crowd reaction"],
      popularityEvidence: ["The Kick Six is consistently treated as one of the defining plays in college football history."],
      trendSources: [],
      template: "MOMENT",
      fanAllegianceLogic: "Stay completely inside Auburn's point of view; Alabama is the opponent, not a co-hero.",
      teams: ["Auburn", "Alabama"],
      year: "2013",
      players: ["Chris Davis", "Nick Marshall", "AJ McCarron"],
      anticipatedLength: "18–24 sec",
    },
    {
      headline: "Vince Young on 4th-and-5 — the Rose Bowl ending",
      sport: "football",
      summary: "Start with the stakes, then let Vince Young's final touchdown run and the crowd reaction carry the reel.",
      whyToday: "The 2006 Rose Bowl still feels cinematic and works perfectly as a short story with a single payoff.",
      viewerFeeling: "inevitability and awe",
      searchQueries: ["Vince Young 4th and 5 Rose Bowl 2006 broadcast", "Texas USC Rose Bowl final drive"],
      popularityEvidence: ["Vince Young's winning run is among the most iconic championship moments in the sport."],
      trendSources: [],
      template: "MOMENT",
      fanAllegianceLogic: "Center Texas and Vince Young; USC provides the championship stakes.",
      teams: ["Texas", "USC"],
      year: "2006",
      players: ["Vince Young", "Reggie Bush", "Matt Leinart"],
      anticipatedLength: "20–27 sec",
    },
    {
      headline: "The shot that ended Kentucky's perfect season",
      sport: "basketball",
      summary: "Use Wisconsin's 2015 Final Four upset as a compressed story: undefeated Kentucky, late-game tension, then Wisconsin closing the door.",
      whyToday: "It is a recognizable March Madness story that gives the feed basketball variety outside tournament season.",
      viewerFeeling: "tension and upset nostalgia",
      searchQueries: ["Wisconsin Kentucky 2015 Final Four highlights", "Wisconsin ends Kentucky undefeated season 2015"],
      popularityEvidence: ["Kentucky entered 38-0, giving the game instant historical stakes."],
      trendSources: [],
      template: "STORY",
      fanAllegianceLogic: "Tell it through Wisconsin's upset perspective; Kentucky is the unbeaten giant.",
      teams: ["Wisconsin", "Kentucky"],
      year: "2015",
      players: ["Frank Kaminsky", "Sam Dekker", "Karl-Anthony Towns", "Devin Booker"],
      anticipatedLength: "24–30 sec",
    },
    {
      headline: "Boise State's Statue of Liberty — the perfect ending",
      sport: "football",
      summary: "Cut the 2007 Fiesta Bowl finish around the hook-and-lateral, overtime touchdown and Statue of Liberty two-point conversion.",
      whyToday: "It is a complete underdog movie in less than 30 seconds and fits Film Room's historic-but-alive identity.",
      viewerFeeling: "joy, surprise and underdog nostalgia",
      searchQueries: ["Boise State Oklahoma 2007 Fiesta Bowl Statue of Liberty", "Boise State Fiesta Bowl trick plays broadcast"],
      popularityEvidence: ["The ending is one of the most famous trick-play sequences in college football history."],
      trendSources: [],
      template: "STORY",
      fanAllegianceLogic: "Stay with Boise State's underdog perspective from setup through celebration.",
      teams: ["Boise State", "Oklahoma"],
      year: "2007",
      players: ["Jared Zabransky", "Ian Johnson", "Adrian Peterson"],
      anticipatedLength: "25–30 sec",
    },
  ];
}

function normalizeStory(s: any): PitchStory {
  return {
    headline: String(s.headline),
    sport: s.sport === "basketball" ? "basketball" : "football",
    summary: String(s.summary ?? ""),
    whyToday: String(s.whyToday ?? "Seasonally relevant Film Room idea."),
    viewerFeeling: String(s.viewerFeeling ?? "nostalgia, anticipation, or connection"),
    searchQueries: Array.isArray(s.searchQueries) && s.searchQueries.length ? s.searchQueries.slice(0, 3).map(String) : [String(s.headline)],
    popularityEvidence: Array.isArray(s.popularityEvidence) ? s.popularityEvidence.map(String) : [],
    trendSources: [],
    template: ["MOMENT", "FEELING", "STORY", "TAKE"].includes(s.template) ? s.template : "STORY",
    fanAllegianceLogic: String(s.fanAllegianceLogic ?? "Keep one emotional point of view unless rivalry conflict is the story."),
    teams: Array.isArray(s.teams) ? s.teams.slice(0, 4).map(String) : [],
    year: String(s.year ?? "—"),
    players: Array.isArray(s.players) ? s.players.slice(0, 5).map(String) : [],
    anticipatedLength: String(s.anticipatedLength ?? "20–30 sec"),
  };
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
Voice principles: ${(brain?.voice?.principles ?? []).join(" ")}
Create exactly 5 specific reel ideas. Do not give vague concepts like "best entrances" unless you anchor each pitch to a specific real game, team, player, rivalry or moment. Do not invent breaking news.
Mix football and basketball when possible. Favor famous, easy-to-source moments that work as 15-30 second edits without voiceover.
For every pitch include the actual teams, year/season, recognizable players involved, and your anticipated final reel length.
Return ONLY valid JSON: {"stories":[{"headline":"...","sport":"football|basketball","summary":"...","whyToday":"...","viewerFeeling":"...","searchQueries":["...","..."],"popularityEvidence":["..."],"trendSources":[],"template":"MOMENT|FEELING|STORY|TAKE","fanAllegianceLogic":"...","teams":["Team A","Team B"],"year":"2013","players":["Player One","Player Two"],"anticipatedLength":"22–28 sec"}]}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: PITCH_MODEL, max_tokens: 1800, temperature: 0.75, messages: [{ role: "user", content: prompt }] }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? `Anthropic request failed (${response.status})`);
    const text = (payload?.content ?? []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n");
    const parsed = extractJson(text);
    const normalized = (Array.isArray(parsed?.stories) ? parsed.stories : [])
      .filter((s: any) => s?.headline && (s.sport === "football" || s.sport === "basketball"))
      .slice(0, 5)
      .map(normalizeStory);
    return normalized.length === 5 ? normalized : fallbackPitches();
  } catch (error) {
    console.warn("Pitch AI unavailable; using reliable editorial fallback.", error);
    return fallbackPitches();
  } finally {
    clearTimeout(timer);
  }
}

export async function POST() {
  try {
    await requireOwner();
    const brain = await getBrandBrain();
    const db = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const stories = await generatePitchIdeas(today, brain);

    const pitchRows = stories.map((story, index) => ({
      slate_date: today,
      candidate_kind: "pitch",
      headline: story.headline,
      sport: story.sport,
      summary: story.summary,
      source_urls: [],
      score: Math.max(7.2, 9.6 - index * 0.35),
      score_breakdown: {
        story,
        kind: "pitch",
        why_today: story.whyToday,
        viewer_feeling: story.viewerFeeling,
        template: story.template,
        fan_allegiance_logic: story.fanAllegianceLogic,
        teams: story.teams,
        year: story.year,
        players: story.players,
        anticipated_length: story.anticipatedLength,
      },
      selected: false,
      rejection_reason: null,
    }));

    const { error: deleteError } = await db.from("candidates").delete().eq("slate_date", today).eq("candidate_kind", "pitch");
    if (deleteError) throw deleteError;
    const { data, error } = await db.from("candidates").insert(pitchRows).select();
    if (error) throw error;
    return NextResponse.json({ pitches: data ?? [], count: data?.length ?? 0 });
  } catch (err: any) {
    console.error("Pitch generation failed:", err);
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : status === 403 ? "Owner access required." : err?.message ?? "Pitch generation failed" }, { status });
  }
}
