"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Pitch = { id:string; headline:string; sport:string; summary:string|null; score:number|null; score_breakdown:any; selected:boolean };
type JobState = { id:string; headline:string; status:"queued"|"building"|"ready"|"failed"; message?:string };

export default function PitchBoard({ pitches }: { pitches: Pitch[] }) {
  const router = useRouter();
  const [selected,setSelected] = useState<string[]>([]);
  const [loading,setLoading] = useState(false);
  const [moreLoading,setMoreLoading] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [jobs,setJobs] = useState<JobState[]>([]);
  const selectedSet = useMemo(()=>new Set(selected),[selected]);

  function toggle(id:string){
    setSelected(current=>current.includes(id)?current.filter(x=>x!==id):current.length>=3?current:[...current,id]);
  }

  async function generateOneMore(){
    setMoreLoading(true);
    setError(null);
    try{
      const res = await fetch("/api/generate-more-pitch",{method:"POST"});
      const raw = await res.text();
      let data:any={};
      try { data = raw ? JSON.parse(raw) : {}; } catch {}
      if(!res.ok || data?.error) throw new Error(data?.error ?? `Could not generate another pitch (${res.status})`);
      router.refresh();
    }catch(e:any){
      setError(e?.message ?? "Could not generate another pitch.");
    }finally{
      setMoreLoading(false);
    }
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
    <div className="space-y-5">
      <div className="soft-card p-6 flex items-end justify-between gap-5">
        <div>
          <div className="label-eyebrow mb-1">TODAY&apos;S PITCHES</div>
          <h2 className="font-display text-3xl tracking-wide text-ink">PICK YOUR THREE</h2>
          <p className="text-dim text-sm mt-1">Start with 5 detailed ideas. If none quite hit, generate another without replacing these.</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xs tracking-[0.16em] text-dim mb-2">{selected.length}/3 SELECTED</div>
          <button onClick={buildSelected} disabled={selected.length!==3||loading} className="btn-primary disabled:opacity-40">Build 3 Selected Reels</button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-milan/20 bg-milan/5 px-4 py-3 text-signal text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        {pitches.map((pitch,index)=>{
          const active=selectedSet.has(pitch.id);
          const meta=pitch.score_breakdown??{};
          const teams = Array.isArray(meta.teams) ? meta.teams : meta.story?.teams ?? [];
          const players = Array.isArray(meta.players) ? meta.players : meta.story?.players ?? [];
          const year = meta.year ?? meta.story?.year ?? "—";
          const anticipatedLength = meta.anticipated_length ?? meta.story?.anticipatedLength ?? "20–30 sec";
          return <button
            key={pitch.id}
            onClick={()=>toggle(pitch.id)}
            disabled={loading}
            style={{animationDelay:`${index*55}ms`}}
            className={`text-left panel p-6 transition-all duration-300 animate-[panelIn_420ms_ease_both] ${active?"ring-2 ring-jelly/35 bg-sidecar/70 -translate-y-1":"hover:bg-white"}`}
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] tracking-[0.18em] text-dim">PITCH {String(index+1).padStart(2,"0")}</span>
                <span className="rounded-full bg-sinbad/30 px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-jelly">{meta.template??"STORY"}</span>
                <span className="rounded-full bg-sidecar px-2 py-1 font-mono text-[9px] tracking-[0.14em] text-ink/70">{String(pitch.sport).toUpperCase()}</span>
              </div>
              <span className={`h-6 w-6 grid place-items-center rounded-full border text-xs transition-all duration-300 ${active?"border-jelly bg-jelly text-white scale-110":"border-rule bg-white text-transparent"}`}>✓</span>
            </div>

            <h3 className="font-display text-2xl tracking-wide text-ink mb-2">{pitch.headline}</h3>
            <p className="text-sm text-dim leading-6 mb-5">{pitch.summary}</p>

            <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
              <div className="rounded-xl bg-sinbad/14 px-3 py-2.5"><div className="font-mono text-[9px] tracking-[0.14em] text-dim mb-1">TEAMS</div><div className="text-ink font-medium">{teams.length?teams.join(" vs. "):"TBD"}</div></div>
              <div className="rounded-xl bg-sidecar/65 px-3 py-2.5"><div className="font-mono text-[9px] tracking-[0.14em] text-dim mb-1">YEAR</div><div className="text-ink font-medium">{year}</div></div>
              <div className="rounded-xl bg-white border border-rule px-3 py-2.5 col-span-2"><div className="font-mono text-[9px] tracking-[0.14em] text-dim mb-1">KEY PLAYERS</div><div className="text-ink/80">{players.length?players.join(" · "):"No specific player required"}</div></div>
            </div>

            <div className="border-t border-rule pt-4 space-y-3">
              <div className="text-xs leading-5"><span className="text-dim">WHY NOW — </span><span className="text-ink/80">{meta.why_today??"Strong seasonal Film Room idea."}</span></div>
              <div className="flex items-center justify-between text-xs font-mono tracking-wider text-dim">
                <span className="text-jelly">EST. {anticipatedLength}</span>
                <span>INTEREST {Number(pitch.score??0).toFixed(1)}</span>
              </div>
            </div>
          </button>
        })}

        <button
          onClick={generateOneMore}
          disabled={moreLoading||loading}
          className="min-h-[250px] rounded-2xl border border-dashed border-jelly/30 bg-sinbad/8 hover:bg-sinbad/14 hover:border-jelly/50 transition-all duration-300 group flex flex-col items-center justify-center text-center p-8"
        >
          <span className="h-11 w-11 rounded-full bg-jelly text-white text-2xl grid place-items-center mb-4 transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110">+</span>
          <span className="font-display text-xl tracking-wide text-ink">{moreLoading?"THE BRAIN IS PITCHING…":"GENERATE ONE MORE"}</span>
          <span className="text-xs text-dim mt-2 max-w-[220px]">Adds one fresh idea without replacing the pitches already on your board.</span>
        </button>
      </div>
    </div>

    {loading && <div className="fixed inset-0 z-50 bg-[#fffaf1]/92 backdrop-blur-md flex items-center justify-center p-6 animate-[pageReveal_260ms_ease_both]"><div className="w-full max-w-2xl rounded-3xl border border-rule bg-white shadow-[0_28px_80px_rgba(37,121,155,0.18)] overflow-hidden">
      <div className="border-b border-rule px-7 py-5 flex items-center justify-between bg-sidecar/55"><div><div className="label-eyebrow mb-1">FILM ROOM / PRODUCTION DESK</div><div className="font-display text-2xl tracking-wide text-ink">BUILDING YOUR 3 REEL JOBS</div></div><div className="animated-dot h-3 w-3 rounded-full bg-jelly"/></div>
      <div className="px-7 py-6 space-y-3">{jobs.map((job,i)=><div key={job.id} className="rounded-2xl border border-rule bg-[#fffdf8] p-4"><div className="flex items-center justify-between gap-4"><div><div className="font-mono text-[10px] tracking-[0.18em] text-dim">REEL {String(i+1).padStart(2,"0")}</div><div className="font-display text-lg tracking-wide text-ink mt-1">{job.headline}</div></div><div className={`font-mono text-xs tracking-wider ${job.status==="ready"?"text-go":job.status==="failed"?"text-signal":job.status==="building"?"text-jelly":"text-dim"}`}>{job.status==="ready"?"✓ READY":job.status==="failed"?"× FAILED":job.status==="building"?"● BUILDING":"○ QUEUED"}</div></div>{job.message&&<div className="text-xs text-dim mt-2">{job.message}</div>}</div>)}</div>
      <div className="border-t border-rule px-7 py-4 font-mono text-[11px] tracking-[0.16em] text-dim bg-sinbad/10">EACH REEL BUILDS INDEPENDENTLY — ONE FAILURE WILL NOT ERASE THE OTHERS</div>
    </div></div>}
  </>;
}
