import { supabaseAdmin } from "@/lib/supabaseServer";
import { Reel } from "@/lib/types";
import Link from "next/link";
import { StatusPill, ScoreBadge } from "@/components/Badges";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const db = supabaseAdmin();
  const { data: reels } = await db
    .from("reels")
    .select("*")
    .order("slate_date", { ascending: false })
    .limit(100);

  const list = (reels ?? []) as Reel[];

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-3xl tracking-wide mb-8">ARCHIVE</h1>
      <div className="space-y-2">
        {list.map((reel) => (
          <Link
            key={reel.id}
            href={`/reel/${reel.id}`}
            className="panel p-3 flex items-center gap-4 hover:border-dim block"
          >
            <span className="font-mono text-dim text-xs w-20 shrink-0">{reel.slate_date}</span>
            <span className="flex-1 min-w-0 truncate">{reel.headline}</span>
            <ScoreBadge score={reel.predicted_interest} />
            <StatusPill status={reel.status} />
          </Link>
        ))}
        {list.length === 0 && <div className="panel p-8 text-center text-dim">No reels yet.</div>}
      </div>
    </div>
  );
}
