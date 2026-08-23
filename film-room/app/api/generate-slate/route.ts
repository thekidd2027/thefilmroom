import { NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { researchTodaysStories } from "@/lib/openai";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const maxDuration = 120;

export async function POST() {
  try {
    const brain = await getBrandBrain();
    const db = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    // Regenerating ideas should never delete reels already being worked on.
    await db
      .from("candidates")
      .delete()
      .eq("slate_date", today)
      .eq("candidate_kind", "pitch");

    const stories = (await researchTodaysStories(brain, today)).slice(0, 12);

    if (!stories.length) {
      return NextResponse.json(
        { error: "The Brain could not build a pitch board. Try again in a moment." },
        { status: 500 }
      );
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

    const { data, error } = await db
      .from("candidates")
      .insert(pitchRows)
      .select();

    if (error) throw error;

    return NextResponse.json({ pitches: data ?? [], count: data?.length ?? 0 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? "Pitch generation failed" },
      { status: 500 }
    );
  }
}
