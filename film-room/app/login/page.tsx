"use client";
import { FormEvent, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function LoginPage(){
  const [email,setEmail]=useState(""); const [msg,setMsg]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){
    e.preventDefault(); setBusy(true); setMsg("");
    const supabase=supabaseBrowser();
    const { error }=await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo:`${window.location.origin}/auth/callback` } });
    setMsg(error?error.message:"Check your email for the Film Room sign-in link."); setBusy(false);
  }
  return <div className="min-h-screen grid place-items-center bg-ink p-6"><form onSubmit={submit} className="panel p-6 w-full max-w-sm space-y-4">
    <div><div className="label-eyebrow">FILM ROOM</div><h1 className="font-display text-2xl mt-1">Newsroom sign in</h1></div>
    <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" className="w-full bg-bay2 border border-rule rounded-sm px-3 py-2" />
    <button disabled={busy} className="btn-go w-full">{busy?"Sending…":"Email me a sign-in link"}</button>
    {msg&&<p className="text-sm text-dim">{msg}</p>}
  </form></div>
}
