import { NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/requireOwner";

export const maxDuration = 45;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const PITCH_MODEL = process.env.ANTHROPIC_PITCH_MODEL ?? "claude-haiku-4-5";

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Unreadable pitch response");
  }
}

export async function POST() {
  try {
    await requireOwner();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY is required." }, { status: 400 });

    const db = supabaseAdmin();
    const brain = await getBrandBrain();
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await db.from("candidates").select("headline").eq("slate_date", today).eq("candidate_kind", "pitch");
    const used = (existing ?? []).map((x: any) => x.headline);

    const prompt = `You are the Film Room college-sports pitch desk. Generate exactly ONE new reel pitch that is clearly different from these existing pitches: ${used.join(" | ")}.
Film Room thesis: make today's college sports feel historic and historic college sports feel alive again.
Voice: ${(brain?.voice?.principles ?? []).join(" ")}
Choose a specific real college football or college basketball game, play, rivalry, team, or player moment. Prefer famous footage that should be easy to find on YouTube. Do not invent facts or breaking news.
Include actual teams, year, notable players and a realistic anticipated final edit length between 15 and 30 seconds.
Return ONLY valid JSON: {"headline":"...","sport":"football|basketball","summary":"...","whyToday":"...","viewerFeeling":"...","searchQueries":["...","..."],"popularityEvidence":["..."],"template":"MOMENT|FEELING|STORY|TAKE","fanAllegianceLogic":"...","teams":["..."],"year":"...","players":["..."],"anticipatedLength":"22–28 sec"}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: PITCH_MODEL, max_tokens: 700, temperature: 0.85, messages: [{ role: "user", content: prompt }] }),
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? `Anthropic request failed (${response.status})`);
      const text = (payload?.content ?? []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("\n");
      const s = extractJson(text);
      if (!s?.headline) throw new Error("The Brain did not return a usable pitch.");

      const story = {
        headline: String(s.headline),
        sport: s.sport === "basketball" ? "basketball" : "football",
        summary: String(s.summary ?? ""),
        whyToday: String(s.whyToday ?? "Strong evergreen Film Room idea."),
        viewerFeeling: String(s.viewerFeeling ?? "nostalgia and excitement"),
        searchQueries: Array.isArray(s.searchQueries) ? s.searchQueries.slice(0, 3).map(String) : [String(s.headline)],
        popularityEvidence: Array.isArray(s.popularityEvidence) ? s.popularityEvidence.map(String) : [],
        trendSources: [],
        template: ["MOMENT", "FEELING", "STORY", "TAKE"].includes(s.template) ? s.template : "STORY",
        fanAllegianceLogic: String(s.fanAllegianceLogic ?? "Keep one emotional point of view."),
        teams: Array.isArray(s.teams) ? s.teams.slice(0, 4).map(String) : [],
        year: String(s.year ?? "—"),
        players: Array.isArray(s.players) ? s.players.slice(0, 5).map(String) : [],
        anticipatedLength: String(s.anticipatedLength ?? "20–30 sec"),
      };

      const row = {
        slate_date: today,
        candidate_kind: "pitch",
        headline: story.headline,
        sport: story.sport,
        summary: story.summary,
        source_urls: [],
        score: 8.4,
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
      };

      const { data, error } = await db.from("candidates").insert(row).select().single();
      if (error) throw error;
      return NextResponse.json({ pitch: data });
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    console.error("Generate-more pitch failed:", err);
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : status === 403 ? "Owner access required." : err?.message ?? "Could not generate another pitch." }, { status });
  }
}
