"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Reel } from "@/lib/types";
import { ScoreBadge, StatusPill } from "./Badges";

const REASONS = ["Weak idea", "Not viral enough", "Wrong content style", "Too generic", "Bad source footage", "Doesn't fit Film Room"];

export default function TodayReelRow({ reel }: { reel: Reel }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();

  async function act(action: "approve" | "reject", rejectionReason?: string) {
    setBusy(true);
    await fetch(`/api/reels/${reel.id}/${action}`, { method: "POST", headers:{"Content-Type":"application/json"}, body: action === "reject" ? JSON.stringify({ reason: rejectionReason || "Rejected without a reason" }) : undefined });
    setBusy(false); setRejecting(false); setReason(""); router.refresh();
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center gap-4">
        <div className="font-mono text-dim text-sm w-6">#{reel.slot}</div>
        <div className="flex-1 min-w-0">
          <Link href={`/reel/${reel.id}`} className="font-medium hover:text-tally">{reel.headline}</Link>
          <div className="text-dim text-sm mt-0.5 flex items-center gap-2"><span className="capitalize">{reel.sport}</span><span>·</span><StatusPill status={reel.status} /></div>
        </div>
        <ScoreBadge score={reel.predicted_interest} />
        {reel.status === "proposed" && <div className="flex gap-2"><button onClick={() => act("approve")} disabled={busy} className="btn-go">Approve</button><button onClick={() => setRejecting(v=>!v)} disabled={busy} className="btn-signal">Reject</button></div>}
      </div>
      {rejecting && <div className="mt-4 ml-10 rounded-[1.4rem] border border-milan/20 bg-milan/5 p-4"><div className="label-eyebrow text-signal mb-2">WHY ARE WE KILLING THIS?</div><div className="flex flex-wrap gap-2 mb-3">{REASONS.map(r=><button key={r} onClick={()=>setReason(r)} className={`rounded-full border px-3 py-1.5 text-xs transition ${reason===r?"bg-milan text-white border-milan":"bg-white border-rule text-dim hover:border-milan/40"}`}>{r}</button>)}</div><div className="flex gap-2"><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Or tell the Brain exactly why…" className="flex-1 rounded-full border border-rule bg-white px-4 py-2 text-sm outline-none focus:border-milan/40"/><button onClick={()=>act("reject",reason)} disabled={busy||!reason.trim()} className="btn-signal disabled:opacity-40">Reject + Teach Brain</button></div></div>}
    </div>
  );
}
