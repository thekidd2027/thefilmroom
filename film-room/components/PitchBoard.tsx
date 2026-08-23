"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Pitch = {
  id: string;
  headline: string;
  sport: string;
  summary: string | null;
  score: number | null;
  score_breakdown: any;
  selected: boolean;
};

const buildStages = [
  "SEARCHING SOURCE FOOTAGE",
  "RANKING ANGLES + MOMENTS",
  "GROUNDING TIMESTAMPS",
  "BUILDING EDIT RECIPES",
  "FINAL EDITORIAL PASS",
];

export default function PitchBoard({ pitches }: { pitches: Pitch[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  async function buildSelected() {
    if (selected.length !== 3) return;
    setLoading(true);
    setError(null);
    setStage(0);
    const timer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, buildStages.length - 1));
    }, 5000);

    try {
      const res = await fetch("/api/build-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Build failed");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="label-eyebrow mb-1">TODAY&apos;S PITCHES</div>
            <h2 className="font-display text-2xl tracking-wide">PICK YOUR THREE</h2>
            <p className="text-dim text-sm mt-1">The Brain found {pitches.length} ideas. Choose the three worth producing.</p>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs tracking-[0.16em] text-dim mb-2">{selected.length}/3 SELECTED</div>
            <button
              onClick={buildSelected}
              disabled={selected.length !== 3 || loading}
              className="btn-primary disabled:opacity-40"
            >
              Build 3 Selected Reels
            </button>
          </div>
        </div>

        {error && <div className="text-signal text-sm">{error}</div>}

        <div className="grid md:grid-cols-2 gap-3">
          {pitches.map((pitch, index) => {
            const active = selectedSet.has(pitch.id);
            const meta = pitch.score_breakdown ?? {};
            return (
              <button
                key={pitch.id}
                onClick={() => toggle(pitch.id)}
                className={`text-left panel p-5 transition-all ${active ? "ring-1 ring-[#e7a52f] bg-[#1b1c19]" : "hover:bg-[#1a1b19]"}`}
              >
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-[0.18em] text-dim">PITCH {String(index + 1).padStart(2, "0")}</span>
                    <span className="font-mono text-[10px] tracking-[0.14em] text-[#e7a52f]">{meta.template ?? "STORY"}</span>
                  </div>
                  <span className={`h-5 w-5 grid place-items-center border text-xs ${active ? "border-[#e7a52f] text-[#e7a52f]" : "border-rule text-transparent"}`}>✓</span>
                </div>

                <h3 className="font-display text-xl tracking-wide text-paper mb-2">{pitch.headline}</h3>
                <p className="text-sm text-[#b6b8b3] leading-6 mb-4">{pitch.summary}</p>

                <div className="border-t border-rule pt-3 space-y-2">
                  <div className="text-xs"><span className="text-dim">WHY NOW — </span><span className="text-[#c9cbc6]">{meta.why_today ?? "Strong seasonal Film Room idea."}</span></div>
                  <div className="flex items-center justify-between text-xs font-mono tracking-wider text-dim">
                    <span>{String(pitch.sport).toUpperCase()}</span>
                    <span>INTEREST {Number(pitch.score ?? 0).toFixed(1)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-[#0b0d0b]/95 flex items-center justify-center p-6">
          <div className="w-full max-w-xl border border-[#30332f] bg-[#171918] shadow-2xl">
            <div className="border-b border-[#30332f] px-7 py-5 flex items-center justify-between">
              <div>
                <div className="label-eyebrow mb-1">FILM ROOM / PRODUCTION DESK</div>
                <div className="font-display text-2xl tracking-wide text-paper">BUILDING 3 REEL JOBS</div>
              </div>
              <div className="h-3 w-3 rounded-full bg-[#e7a52f] animate-pulse" />
            </div>
            <div className="px-7 py-7">
              <div className="font-mono text-xs tracking-[0.2em] text-[#e7a52f] mb-2">PROCESS {String(stage + 1).padStart(2, "0")} / 05</div>
              <div className="font-display text-xl tracking-wide text-paper mb-5">{buildStages[stage]}</div>
              <div className="h-1 bg-[#292c29] overflow-hidden">
                <div className="h-full bg-[#e7a52f] transition-all duration-700" style={{ width: `${((stage + 1) / buildStages.length) * 100}%` }} />
              </div>
              <div className="mt-7 space-y-3">
                {buildStages.map((item, i) => (
                  <div key={item} className="flex items-center gap-3 text-xs font-mono tracking-wider">
                    <span className={i < stage ? "text-[#7ba66d]" : i === stage ? "text-[#e7a52f]" : "text-[#555955]"}>{i < stage ? "✓" : i === stage ? "●" : "○"}</span>
                    <span className={i <= stage ? "text-[#b9bcb7]" : "text-[#555955]"}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-[#30332f] px-7 py-4 font-mono text-[11px] tracking-[0.16em] text-[#6f736e]">GROUNDING CLIPS BEFORE THEY REACH AN EDITOR</div>
          </div>
        </div>
      )}
    </>
  );
}
