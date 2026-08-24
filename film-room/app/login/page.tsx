"use client";

import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");

    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMsg(error.message === "Invalid login credentials"
        ? "That email/password combination did not work."
        : error.message);
      setBusy(false);
      return;
    }

    if (!data.session) {
      setMsg("Signed in, but the session was not created. Please try once more.");
      setBusy(false);
      return;
    }

    // Use a full navigation after the auth cookies have been written so the
    // server middleware sees the same session immediately and on later reloads.
    window.location.assign("/today");
  }

  async function forgotPassword() {
    if (!email) {
      setMsg("Enter your email first, then click Forgot password.");
      return;
    }
    setResetBusy(true);
    setMsg("");
    const supabase = supabaseBrowser();
    const redirectTo = `${window.location.origin}/auth/callback?next=/set-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setMsg(error ? error.message : "Password reset email sent. Check your inbox.");
    setResetBusy(false);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink p-6">
      <form onSubmit={submit} className="panel p-7 w-full max-w-md space-y-5">
        <div>
          <div className="label-eyebrow">FILM ROOM</div>
          <h1 className="font-display text-3xl mt-1">Newsroom sign in</h1>
          <p className="text-sm text-dim mt-2">Use your Film Room email and password.</p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full bg-bay2 border border-rule rounded-2xl px-4 py-3"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-bay2 border border-rule rounded-2xl px-4 py-3"
          />
        </div>

        <button disabled={busy} className="btn-primary w-full disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={forgotPassword}
          disabled={resetBusy}
          className="w-full text-sm text-jelly hover:underline disabled:opacity-50"
        >
          {resetBusy ? "Sending reset…" : "Forgot password?"}
        </button>

        {msg && <p className="text-sm text-dim text-center">{msg}</p>}
      </form>
    </div>
  );
}
