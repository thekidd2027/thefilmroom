"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Pitch = { id:string; headline:string; sport:string; summary:string|null; score:number|null; score_breakdown:any; selected:boolean };
type JobState = { id:string; headline:string; status:"queued"|"building"|"ready"|"failed"; message?:string };

export default function PitchBoard({ pitches }: { pitches: Pitch[] }) {
  const router = useRouter();
  const [selected,setSelected] = useState<string[]>([]);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [jobs,setJobs] = useState<JobState[]>([]);
  const selectedSet = useMemo(()=>new Set(selected),[selected]);

  function toggle(id:string){
    setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length>=3?current:[...current,id]);
  }

  async function callBuild(id:string,slot:number){
    const res = await fetch("/api/build-one",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,slot})});
    const raw = await res.text();
    let data:any={};
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Server returned an unreadable response (${res.status}).`); }
    if(!res.ok || data?.error) throw new Error(data?.error ?? `Build failed (${res.status})`);
    return data;
  }

  async function buildSelected(){
    if(selected.length!==3) return;
    setLoading(true); setError(null);
    const chosen = selected.map(id=>pitches.find(p=>p.id===id)!).filter(Boolean);
    setJobs(chosen.map(p=>({id:p.id,headline:p.headline,status:"queued"})));
    let ready = 0;

    for(let i=0;i<chosen.length;i++){
      const pitch = chosen[i];
      setJobs(current=>current.map(j=>j.id===pitch.id?{...j,status:"building",message:"Searching sources, grounding timestamps and building the edit recipe…"}:j));
      try{
        await callBuild(pitch.id,i+1);
        ready++;
        setJobs(current=>current.map(j=>j.id===pitch.id?{...j,status:"ready",message:"Editor-ready recipe built."}:j));
      }catch(e:any){
        setJobs(current=>current.map(j=>j.id===pitch.id?{...j,status:"failed",message:e?.message ?? "Build failed"}:j));
      }
    }

    setLoading(false);
    if(ready>0){ router.refresh(); }
    if(ready<3){ setError(`${ready}/3 reels built successfully. Failed pitches can be replaced without losing the successful ones.`); }
  }

  return <>
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div><div className="label-eyebrow mb-1">TODAY&apos;S PITCHES</div><h2 className="font-display text-2xl tracking-wide">PICK YOUR THREE</h2><p className="text-dim text-sm mt-1">The Brain found {pitches.length} ideas. Choose the three worth producing.</p></div>
        <div className="text-right"><div className="font-mono text-xs tracking-[0.16em] text-dim mb-2">{selected.length}/3 SELECTED</div><button onClick={buildSelected} disabled={selected.length!==3||loading} className="btn-primary disabled:opacity-40">Build 3 Selected Reels</button></div>
      </div>
      {error && <div className="text-signal text-sm">{error}</div>}
      <div className="grid md:grid-cols-2 gap-3">
        {pitches.map((pitch,index)=>{ const active=selectedSet.has(pitch.id); const meta=pitch.score_breakdown??{}; return <button key={pitch.id} onClick={()=>toggle(pitch.id)} disabled={loading} className={`text-left panel p-5 transition-all ${active?"ring-1 ring-[#e7a52f] bg-[#1b1c19]":"hover:bg-[#1a1b19]"}`}>
          <div className="flex items-center justify-between gap-4 mb-3"><div className="flex items-center gap-2"><span className="font-mono text-[10px] tracking-[0.18em] text-dim">PITCH {String(index+1).padStart(2,"0")}</span><span className="font-mono text-[10px] tracking-[0.14em] text-[#e7a52f]">{meta.template??"STORY"}</span></div><span className={`h-5 w-5 grid place-items-center border text-xs ${active?"border-[#e7a52f] text-[#e7a52f]":"border-rule text-transparent"}`}>✓</span></div>
          <h3 className="font-display text-xl tracking-wide text-paper mb-2">{pitch.headline}</h3><p className="text-sm text-[#b6b8b3] leading-6 mb-4">{pitch.summary}</p>
          <div className="border-t border-rule pt-3 space-y-2"><div className="text-xs"><span className="text-dim">WHY NOW — </span><span className="text-[#c9cbc6]">{meta.why_today??"Strong seasonal Film Room idea."}</span></div><div className="flex items-center justify-between text-xs font-mono tracking-wider text-dim"><span>{String(pitch.sport).toUpperCase()}</span><span>INTEREST {Number(pitch.score??0).toFixed(1)}</span></div></div>
        </button>})}
      </div>
    </div>

    {loading && <div className="fixed inset-0 z-50 bg-[#0b0d0b]/95 flex items-center justify-center p-6"><div className="w-full max-w-2xl border border-[#30332f] bg-[#171918] shadow-2xl">
      <div className="border-b border-[#30332f] px-7 py-5 flex items-center justify-between"><div><div className="label-eyebrow mb-1">FILM ROOM / PRODUCTION DESK</div><div className="font-display text-2xl tracking-wide text-paper">BUILDING YOUR 3 REEL JOBS</div></div><div className="h-3 w-3 rounded-full bg-[#e7a52f] animate-pulse"/></div>
      <div className="px-7 py-6 space-y-3">{jobs.map((job,i)=><div key={job.id} className="border border-[#30332f] p-4"><div className="flex items-center justify-between gap-4"><div><div className="font-mono text-[10px] tracking-[0.18em] text-dim">REEL {String(i+1).padStart(2,"0")}</div><div className="font-display text-lg tracking-wide text-paper mt-1">{job.headline}</div></div><div className={`font-mono text-xs tracking-wider ${job.status==="ready"?"text-[#7ba66d]":job.status==="failed"?"text-signal":job.status==="building"?"text-[#e7a52f]":"text-[#555955]"}`}>{job.status==="ready"?"✓ READY":job.status==="failed"?"× FAILED":job.status==="building"?"● BUILDING":"○ QUEUED"}</div></div>{job.message&&<div className="text-xs text-dim mt-2">{job.message}</div>}</div>)}</div>
      <div className="border-t border-[#30332f] px-7 py-4 font-mono text-[11px] tracking-[0.16em] text-[#6f736e]">EACH REEL BUILDS INDEPENDENTLY — ONE FAILURE WILL NOT ERASE THE OTHERS</div>
    </div></div>}
  </>;
}
