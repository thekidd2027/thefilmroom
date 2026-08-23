"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateButton({ hasSlate }: { hasSlate: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
    <div className="text-right">
      <button onClick={generate} disabled={loading} className="btn-primary disabled:opacity-50">
        {loading ? "Scanning college sports…" : hasSlate ? "Regenerate Slate" : "Generate Today's Slate"}
      </button>
      {error && <div className="text-signal text-sm mt-2 max-w-xs">{error}</div>}
    </div>
  );
}
