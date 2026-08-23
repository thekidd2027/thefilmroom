import { supabaseAdmin } from "@/lib/supabaseServer";
import GenerateButton from "@/components/GenerateButton";
import TodayReelRow from "@/components/TodayReelRow";
import { Reel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const db = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data: reels } = await db
    .from("reels")
    .select("*")
    .eq("slate_date", today)
    .order("slot");

  const list = (reels ?? []) as Reel[];

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="label-eyebrow mb-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </div>
          <h1 className="font-display text-3xl tracking-wide">TODAY&apos;S DOSE</h1>
        </div>
        <GenerateButton hasSlate={list.length > 0} />
      </div>

      {list.length === 0 ? (
        <div className="panel p-8 text-center text-dim">
          No slate generated yet today. Click <span className="text-paper">Generate Today&apos;s Slate</span> to
          have the Brain scan college sports and propose 4 reels.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((reel) => (
            <TodayReelRow key={reel.id} reel={reel} />
          ))}
        </div>
      )}
    </div>
  );
}
