"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const stages = [
  { label: "SCANNING THE WIRE", detail: "Looking for current college football and basketball stories" },
  { label: "CHECKING THE ARCHIVE", detail: "Finding evergreen moments, rivalries and stories worth resurfacing" },
  { label: "READING THE ROOM", detail: "Ranking ideas for interest, timing and Film Room fit" },
  { label: "BUILDING THE SLATE", detail: "Turning the strongest ideas into four reel concepts" },
  { label: "FINAL EDITORIAL PASS", detail: "Checking variety, hooks and brand alignment" },
];

export default function GenerateButton({ hasSlate }: { hasSlate: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      setStage(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, stages.length - 1));
    }, 3500);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-slate", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Generation failed");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="text-right">
        <button onClick={generate} disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "Building today's slate…" : hasSlate ? "Regenerate Slate" : "Generate Today's Slate"}
        </button>
        {error && <div className="text-signal text-sm mt-2 max-w-xs">{error}</div>}
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-[#0b0d0b]/95 flex items-center justify-center p-6">
          <div className="w-full max-w-xl border border-[#30332f] bg-[#171918] shadow-2xl">
            <div className="border-b border-[#30332f] px-7 py-5 flex items-center justify-between">
              <div>
                <div className="label-eyebrow mb-1">FILM ROOM / NEWS DESK</div>
                <div className="font-display text-2xl tracking-wide text-paper">BUILDING TODAY&apos;S DOSE</div>
              </div>
              <div className="h-3 w-3 rounded-full bg-[#e7a52f] animate-pulse shadow-[0_0_14px_rgba(231,165,47,0.65)]" />
            </div>

            <div className="px-7 py-7">
              <div className="font-mono text-xs tracking-[0.2em] text-[#e7a52f] mb-2">
                PROCESS {String(stage + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}
              </div>
              <div className="font-display text-xl tracking-wide text-paper mb-2">{stages[stage].label}</div>
              <div className="text-dim text-sm leading-6 min-h-12">{stages[stage].detail}</div>

              <div className="mt-6 h-1 bg-[#292c29] overflow-hidden">
                <div
                  className="h-full bg-[#e7a52f] transition-all duration-700 ease-out"
                  style={{ width: `${((stage + 1) / stages.length) * 100}%` }}
                />
              </div>

              <div className="mt-7 space-y-3">
                {stages.map((item, index) => (
                  <div key={item.label} className="flex items-center gap-3 text-xs font-mono tracking-wider">
                    <span className={index < stage ? "text-[#7ba66d]" : index === stage ? "text-[#e7a52f]" : "text-[#555955]"}>
                      {index < stage ? "✓" : index === stage ? "●" : "○"}
                    </span>
                    <span className={index <= stage ? "text-[#b9bcb7]" : "text-[#555955]"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[#30332f] px-7 py-4 font-mono text-[11px] tracking-[0.16em] text-[#6f736e]">
              THE BRAIN IS ON ASSIGNMENT — THIS CAN TAKE A MOMENT
            </div>
          </div>
        </div>
      )}
    </>
  );
}
