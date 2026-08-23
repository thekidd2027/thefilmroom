"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const stages = [
  { label: "SCANNING THE WIRE", detail: "Looking for current college football and basketball stories" },
  { label: "CHECKING THE ARCHIVE", detail: "Finding evergreen moments, rivalries and stories worth resurfacing" },
  { label: "READING THE ROOM", detail: "Ranking ideas for interest, timing and Film Room fit" },
  { label: "BUILDING THE PITCH BOARD", detail: "Turning the strongest angles into five specific ideas for you to choose from" },
  { label: "FINAL EDITORIAL PASS", detail: "Checking teams, players, years, length and brand alignment" },
];

export default function GenerateButton({ hasSlate }: { hasSlate: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!loading) { setStage(0); return; }
    const timer = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 3000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-slate", { method: "POST" });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch {
        throw new Error(res.ok ? "The server returned an unreadable response. Try again." : `Pitch generation failed on the server (${res.status}).`);
      }
      if (!res.ok || data?.error) throw new Error(data?.error ?? `Generation failed (${res.status})`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Pitch generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="text-right">
        <button onClick={generate} disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "Building today's pitches…" : hasSlate ? "Refresh 5 Pitches" : "Generate Today's Pitches"}
        </button>
        {error && <div className="text-signal text-sm mt-2 max-w-xs">{error}</div>}
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-[#fffaf1]/92 backdrop-blur-md flex items-center justify-center p-6 animate-[pageReveal_250ms_ease_both]">
          <div className="w-full max-w-xl rounded-3xl border border-rule bg-white shadow-[0_28px_80px_rgba(37,121,155,0.18)] overflow-hidden">
            <div className="border-b border-rule px-8 py-6 flex items-center justify-between bg-sidecar/55">
              <div>
                <div className="label-eyebrow mb-1">FILM ROOM / NEWS DESK</div>
                <div className="font-display text-3xl tracking-wide text-ink">BUILDING TODAY&apos;S PITCH BOARD</div>
              </div>
              <div className="animated-dot h-3 w-3 rounded-full bg-jelly" />
            </div>

            <div className="px-8 py-8">
              <div className="font-mono text-xs tracking-[0.2em] text-jelly mb-2">PROCESS {String(stage + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}</div>
              <div className="font-display text-xl tracking-wide text-ink mb-2">{stages[stage].label}</div>
              <div className="text-dim text-sm leading-6 min-h-12">{stages[stage].detail}</div>

              <div className="mt-6 h-1.5 rounded-full bg-sinbad/20 overflow-hidden">
                <div className="h-full rounded-full bg-jelly transition-all duration-700 ease-out shimmer-line" style={{ width: `${((stage + 1) / stages.length) * 100}%` }} />
              </div>

              <div className="mt-7 space-y-3">
                {stages.map((item, index) => (
                  <div key={item.label} className="flex items-center gap-3 text-xs font-mono tracking-wider">
                    <span className={index < stage ? "text-go" : index === stage ? "text-jelly" : "text-rule"}>{index < stage ? "✓" : index === stage ? "●" : "○"}</span>
                    <span className={index <= stage ? "text-ink/75" : "text-dim/50"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-rule px-8 py-4 font-mono text-[10px] tracking-[0.16em] text-dim bg-sinbad/10">NO SOURCE CREDITS ARE SPENT UNTIL YOU PICK THE THREE WORTH PRODUCING</div>
          </div>
        </div>
      )}
    </>
  );
}
