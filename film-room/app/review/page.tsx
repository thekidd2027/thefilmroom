import { supabaseAdmin } from "@/lib/supabaseServer";
import { Reel } from "@/lib/types";
import ReviewRow from "@/components/ReviewRow";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const db = supabaseAdmin();
  const { data: reels } = await db
    .from("reels")
    .select("*")
    .in("status", ["submitted", "changes_requested"])
    .order("updated_at", { ascending: false });

  const list = (reels ?? []) as Reel[];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-3xl tracking-wide mb-8">REVIEW QUEUE</h1>
      {list.length === 0 ? (
        <div className="panel p-8 text-center text-dim">Nothing waiting on you right now.</div>
      ) : (
        <div className="space-y-3">
          {list.map((reel) => (
            <ReviewRow key={reel.id} reel={reel} />
          ))}
        </div>
      )}
    </div>
  );
}
