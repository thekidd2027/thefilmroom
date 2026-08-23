"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function OwnerSetupPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/owner-password-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? "Setup failed.");
      setSuccess(true);
      setMessage("Password created. Remove OWNER_PASSWORD_SETUP_TOKEN from Vercel, then sign in normally.");
    } catch (e: any) {
      setMessage(e?.message ?? "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md soft-card p-7 md:p-9">
        <div className="label-eyebrow mb-2">FILM ROOM / OWNER RECOVERY</div>
        <h1 className="font-display text-3xl tracking-wide text-ink">CREATE OWNER PASSWORD</h1>
        <p className="text-sm text-dim leading-6 mt-2 mb-6">
          One-time recovery only. This does not send an email.
        </p>

        {!success ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="data-label block mb-2">SETUP CODE</label>
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="w-full rounded-[1.4rem] border border-rule bg-white px-4 py-3 text-sm"
                placeholder="OWNER_PASSWORD_SETUP_TOKEN"
              />
            </div>
            <div>
              <label className="data-label block mb-2">NEW PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                className="w-full rounded-[1.4rem] border border-rule bg-white px-4 py-3 text-sm"
                placeholder="At least 10 characters"
              />
            </div>
            <div>
              <label className="data-label block mb-2">CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={10}
                className="w-full rounded-[1.4rem] border border-rule bg-white px-4 py-3 text-sm"
                placeholder="Repeat password"
              />
            </div>
            <button disabled={busy} className="btn-primary w-full disabled:opacity-50">
              {busy ? "Securing account…" : "Create Owner Password"}
            </button>
          </form>
        ) : (
          <button className="btn-primary w-full" onClick={() => router.push("/login")}>Go to Sign In</button>
        )}

        {message && <div className={`mt-5 rounded-[1.4rem] px-4 py-3 text-sm ${success ? "bg-sinbad/20 text-ink" : "bg-milan/5 text-signal"}`}>{message}</div>}
      </div>
    </main>
  );
}
