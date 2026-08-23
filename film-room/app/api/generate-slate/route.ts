import { NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { supabaseAdmin } from "@/lib/supabaseServer";

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

function extractJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The Brain returned an unreadable pitch board.");
  }
}

async function generatePitchIdeas(dateIso: string, brain: any): Promise<PitchStory[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var.");

  const prompt = `You are the editorial pitch desk for Film Room, a college football and college basketball short-form media brand.

Today is ${dateIso}.

Film Room's thesis: make today's college sports feel historic and historic college sports feel alive again.
Core sports: ${(brain?.editorialRules?.coreSports ?? ["college football", "college basketball"]).join(", ")}.
Voice principles: ${(brain?.voice?.principles ?? []).join(" ")}
Season rule: ${brain?.editorialRules?.currentVsFlashback ?? "Use current context when strong, otherwise use seasonally relevant history, rivalries, traditions, player stories and iconic moments."}

Your job right now is ONLY to create a pitch board. Do NOT research source videos, timestamps, transcripts, or edit recipes yet.

Create exactly 10 strong reel ideas. The channel must always have something worth posting, even on a quiet sports day.

Use this editorial mix:
- 2-3 CURRENT/SEASONAL ideas if there is an obvious broad storyline for this time of year. Do not invent breaking news, scores, rankings, injuries, transfers or transactions.
- 3-4 EVERGREEN ideas built around iconic players, plays, traditions, stadium atmosphere, rivalry culture, team identity or emotional college-sports moments.
- 2-3 FLASHBACK/HISTORY ideas that feel timely because of the season/calendar.
- At least 2 ideas should be highly emotional or nostalgic rather than informational.

Favor ideas that will be easy to source later from YouTube and can work as 15-30 second vertical edits without voiceover.

Return ONLY valid JSON in this exact shape:
{"stories":[{"headline":"...","sport":"football|basketball","summary":"one sentence angle","whyToday":"why this belongs on the channel now","viewerFeeling":"what the viewer should feel","searchQueries":["YouTube search 1","YouTube search 2"],"popularityEvidence":["seasonal or cultural rationale"],"trendSources":[],"template":"MOMENT|FEELING|STORY|TAKE","fanAllegianceLogic":"how to keep the reel emotionally coherent"}]}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: PITCH_MODEL,
        max_tokens: 2600,
        temperature: 0.8,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`Anthropic returned a non-JSON response (${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? `Anthropic request failed (${response.status}).`);
    }

    const text = (payload?.content ?? [])
      .filter((block: any) => block?.type === "text")
      .map((block: any) => block.text)
      .join("\n")
      .trim();

    const parsed = extractJson(text);
    const stories = Array.isArray(parsed?.stories) ? parsed.stories : [];

    return stories
      .filter((s: any) => s?.headline && (s.sport === "football" || s.sport === "basketball"))
      .slice(0, 10)
      .map((s: any) => ({
        headline: String(s.headline),
        sport: s.sport,
        summary: String(s.summary ?? ""),
        whyToday: String(s.whyToday ?? "Seasonally relevant Film Room idea."),
        viewerFeeling: String(s.viewerFeeling ?? "nostalgia, anticipation, or connection"),
        searchQueries: Array.isArray(s.searchQueries) && s.searchQueries.length ? s.searchQueries.slice(0, 3).map(String) : [String(s.headline)],
        popularityEvidence: Array.isArray(s.popularityEvidence) ? s.popularityEvidence.map(String) : [],
        trendSources: [],
        template: ["MOMENT", "FEELING", "STORY", "TAKE"].includes(s.template) ? s.template : "STORY",
        fanAllegianceLogic: String(s.fanAllegianceLogic ?? "Keep one emotional point of view unless rivalry conflict is the story."),
      }));
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error("The Brain took too long to build pitches. Try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST() {
  try {
    const brain = await getBrandBrain();
    const db = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    await db
      .from("candidates")
      .delete()
      .eq("slate_date", today)
      .eq("candidate_kind", "pitch");

    const stories = await generatePitchIdeas(today, brain);

    if (!stories.length) {
      throw new Error("The Brain did not return usable pitches. Try again.");
    }

    const pitchRows = stories.map((story, index) => ({
      slate_date: today,
      candidate_kind: "pitch",
      headline: story.headline,
      sport: story.sport,
      summary: story.summary,
      source_urls: [],
      score: Math.max(6.5, 9.6 - index * 0.25),
      score_breakdown: {
        story,
        kind: "pitch",
        why_today: story.whyToday,
        viewer_feeling: story.viewerFeeling,
        template: story.template,
        fan_allegiance_logic: story.fanAllegianceLogic,
      },
      selected: false,
      rejection_reason: null,
    }));

    const { data, error } = await db.from("candidates").insert(pitchRows).select();
    if (error) throw error;

    return NextResponse.json({ pitches: data ?? [], count: data?.length ?? 0 });
  } catch (err: any) {
    console.error("Pitch generation failed:", err);
    return NextResponse.json(
      { error: err?.message ?? "Pitch generation failed" },
      { status: 500 }
    );
  }
}
