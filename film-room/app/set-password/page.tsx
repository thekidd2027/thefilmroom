"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    if (password.length < 8) {
      setMsg("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg(error.message);
      setBusy(false);
      return;
    }

    router.replace("/today");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink p-6">
      <form onSubmit={submit} className="panel p-7 w-full max-w-md space-y-5">
        <div>
          <div className="label-eyebrow">FILM ROOM / ACCESS</div>
          <h1 className="font-display text-3xl mt-1">Create your password</h1>
          <p className="text-sm text-dim mt-2">This is the password you’ll use for normal Film Room sign-in.</p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full bg-bay2 border border-rule rounded-2xl px-4 py-3"
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full bg-bay2 border border-rule rounded-2xl px-4 py-3"
          />
        </div>

        <button disabled={busy} className="btn-primary w-full disabled:opacity-50">
          {busy ? "Saving…" : "Set password & enter Film Room"}
        </button>
        {msg && <p className="text-sm text-dim text-center">{msg}</p>}
      </form>
    </div>
  );
}
