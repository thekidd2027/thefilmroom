"use client";

import { useState } from "react";

export default function BrandBrainEditor({ blockKey, value }: { blockKey: string; value: unknown }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    setError(null);
    try {
      const parsed = JSON.parse(text);
      const res = await fetch("/api/brand-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: blockKey, value: parsed }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Save failed");
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch (e: any) {
      setStatus("error");
      setError(e.message);
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(20, text.split("\n").length + 1)}
        className="w-full bg-bay2 border border-rule rounded-sm px-3 py-2 text-xs font-mono"
        spellCheck={false}
      />
      <div className="flex items-center gap-3 mt-2">
        <button onClick={save} disabled={status === "saving"} className="btn-ghost">
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "saved" && <span className="text-go text-sm">Saved</span>}
        {status === "error" && <span className="text-signal text-sm">{error}</span>}
      </div>
    </div>
  );
}
