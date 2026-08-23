"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Reel } from "@/lib/types";
import { ScoreBadge, StatusPill } from "./Badges";

export default function TodayReelRow({ reel }: { reel: Reel }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function act(action: "approve" | "reject") {
    setBusy(true);
    await fetch(`/api/reels/${reel.id}/${action}`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className="font-mono text-dim text-sm w-6">#{reel.slot}</div>
      <div className="flex-1 min-w-0">
        <Link href={`/reel/${reel.id}`} className="font-medium hover:text-tally">
          {reel.headline}
        </Link>
        <div className="text-dim text-sm mt-0.5 flex items-center gap-2">
          <span className="capitalize">{reel.sport}</span>
          <span>·</span>
          <StatusPill status={reel.status} />
        </div>
      </div>
      <ScoreBadge score={reel.predicted_interest} />
      {reel.status === "proposed" && (
        <div className="flex gap-2">
          <button onClick={() => act("approve")} disabled={busy} className="btn-go">
            Approve
          </button>
          <button onClick={() => act("reject")} disabled={busy} className="btn-signal">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
