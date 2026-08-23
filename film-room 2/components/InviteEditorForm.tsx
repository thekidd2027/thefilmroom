"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteEditorForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function invite() {
    if (!name || !email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/editors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, email }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Invite failed");
      setName("");
      setEmail("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="flex-1 bg-bay2 border border-rule rounded-sm px-3 py-1.5 text-sm"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        className="flex-1 bg-bay2 border border-rule rounded-sm px-3 py-1.5 text-sm"
      />
      <button onClick={invite} disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? "Sending…" : "Invite"}
      </button>
      {error && <div className="text-signal text-sm">{error}</div>}
    </div>
  );
}
