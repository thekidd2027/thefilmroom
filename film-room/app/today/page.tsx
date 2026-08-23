import { supabaseAdmin } from "@/lib/supabaseServer";
import GenerateButton from "@/components/GenerateButton";
import TodayReelRow from "@/components/TodayReelRow";
import PitchBoard from "@/components/PitchBoard";
import { Reel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const db = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: reels }, { data: pitches }] = await Promise.all([
    db.from("reels").select("*").eq("slate_date", today).order("slot"),
    db.from("candidates").select("id,headline,sport,summary,score,score_breakdown,selected").eq("slate_date", today).eq("candidate_kind", "pitch").order("score", { ascending: false }),
  ]);

  const list = (reels ?? []) as Reel[];
  const rejectedHeadlines = new Set(list.filter((r:any) => r.status === "rejected").map((r:any) => String(r.headline).trim().toLowerCase()));
  const pitchList = (pitches ?? []).filter((p:any) => !rejectedHeadlines.has(String(p.headline).trim().toLowerCase()));
  const activeReels = list.filter((r:any) => r.status !== "rejected");
  const needsMore = activeReels.length < 3;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="label-eyebrow mb-1">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
          <h1 className="font-display text-3xl tracking-wide">TODAY&apos;S DOSE</h1>
        </div>
        <GenerateButton hasSlate={pitchList.length > 0 || list.length > 0} />
      </div>

      {list.length > 0 && (
        <div className="space-y-3 mb-8">
          <div className="flex items-end justify-between mb-3">
            <div><div className="label-eyebrow mb-1">PRODUCTION SLATE</div><h2 className="font-display text-2xl tracking-wide">{activeReels.length}/3 ACTIVE REEL JOBS</h2></div>
          </div>
          {list.map((reel) => <TodayReelRow key={reel.id} reel={reel} />)}
        </div>
      )}

      {pitchList.length > 0 && needsMore ? (
        <PitchBoard pitches={pitchList as any} />
      ) : activeReels.length === 0 && pitchList.length === 0 ? (
        <div className="panel p-8 text-center text-dim">No pitches generated yet today. Click <span className="text-paper">Generate Today&apos;s Pitches</span> to have the Brain build a fresh board.</div>
      ) : null}
    </div>
  );
}
