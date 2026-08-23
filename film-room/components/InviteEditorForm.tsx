"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InviteEditorForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  async function invite() {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/editors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Invite failed");
      setSuccess(`Invite sent to ${email.trim()}. They'll create their own password.`);
      setFirstName("");
      setLastName("");
      setEmail("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          className="bg-bay2 border border-rule rounded-2xl px-4 py-3 text-sm"
        />
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name"
          className="bg-bay2 border border-rule rounded-2xl px-4 py-3 text-sm"
        />
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Editor email"
          type="email"
          className="flex-1 bg-bay2 border border-rule rounded-2xl px-4 py-3 text-sm"
        />
        <button onClick={invite} disabled={busy} className="btn-primary disabled:opacity-50 md:min-w-[150px]">
          {busy ? "Creating…" : "Add editor"}
        </button>
      </div>
      <p className="text-xs text-dim">Film Room sends one setup email. The editor chooses their own password; you never need to know it.</p>
      {error && <div className="rounded-2xl border border-milan/20 bg-milan/5 px-4 py-3 text-signal text-sm">{error}</div>}
      {success && <div className="rounded-2xl border border-jelly/20 bg-sinbad/10 px-4 py-3 text-sm text-ink">{success}</div>}
    </div>
  );
}
