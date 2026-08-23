"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Pitch = { id:string; headline:string; sport:string; summary:string|null; score:number|null; score_breakdown:any; selected:boolean };
type JobState = { id:string; headline:string; status:"queued"|"building"|"ready"|"failed"; message?:string };

const formatNames:any = {
  INTERVIEW_STORY:"INTERVIEW → STORY",
  PLAYER_HIGHLIGHT:"PLAYER SPOTLIGHT",
  TEAM_HIGHLIGHT:"SCHOOL FEATURE",
  RIVALRY:"RIVALRY",
  MOMENT:"ICONIC MOMENT",
  STORY:"STORY"
};

const buildPhases = [
  { label:"SOURCE SCAN", detail:"Searching broadcasts, interviews, documentaries and highlight footage." },
  { label:"SIGNAL CHECK", detail:"Comparing source quality, relevance, popularity and Film Room fit." },
  { label:"GROUNDING", detail:"Finding usable moments, transcript beats and visual timestamps." },
  { label:"EDIT ARCHITECTURE", detail:"Assembling the hook, clip order, pacing, music direction and payoff." },
  { label:"FINAL RECIPE", detail:"Locking cover text, caption, alternates and editor-ready instructions." }
];

export default function PitchBoard({pitches}:{pitches:Pitch[]}) {
  const router = useRouter();
  const recommended = pitches.filter(p => ["PRIMARY","SECONDARY"].includes(p.score_breakdown?.recommendation ?? p.score_breakdown?.story?.recommendation));
  const initial = (recommended.length===2 ? recommended : pitches.slice(0,2)).map(p=>p.id);
  const [selected,setSelected] = useState<string[]>(initial);
  const [loading,setLoading] = useState(false);
  const [moreLoading,setMoreLoading] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [jobs,setJobs] = useState<JobState[]>([]);
  const [phase,setPhase] = useState(0);
  const selectedSet = useMemo(()=>new Set(selected),[selected]);

  useEffect(()=>{
    if(!loading){ setPhase(0); return; }
    setPhase(0);
    const timer = window.setInterval(()=>setPhase(p => Math.min(p+1, buildPhases.length-1)), 3200);
    return ()=>window.clearInterval(timer);
  },[loading, jobs.filter(j=>j.status==="building").map(j=>j.id).join("|")]);

  function toggle(id:string){
    setSelected(c=>c.includes(id)?c.filter(x=>x!==id):c.length>=3?c:[...c,id]);
  }

  async function generateOneMore(){
    setMoreLoading(true); setError(null);
    try{
      const res=await fetch("/api/generate-more-pitch",{method:"POST"});
      const raw=await res.text(); let data:any={};
      try{data=raw?JSON.parse(raw):{}}catch{}
      if(!res.ok||data?.error)throw new Error(data?.error??`Could not generate another pitch (${res.status})`);
      router.refresh();
    }catch(e:any){setError(e?.message??"Could not generate another pitch.");}
    finally{setMoreLoading(false)}
  }

  async function callBuild(id:string,slot:number){
    const res=await fetch("/api/build-one",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,slot})});
    const raw=await res.text(); let data:any={};
    try{data=raw?JSON.parse(raw):{}}catch{throw new Error(`Server returned an unreadable response (${res.status}).`)}
    if(!res.ok||data?.error)throw new Error(data?.error??`Build failed (${res.status})`);
    return data;
  }

  async function buildSelected(){
    if(selected.length<1)return;
    setLoading(true); setError(null);
    const chosen=selected.map(id=>pitches.find(p=>p.id===id)!).filter(Boolean);
    setJobs(chosen.map(p=>({id:p.id,headline:p.headline,status:"queued"})));
    let ready=0;
    for(let i=0;i<chosen.length;i++){
      const pitch=chosen[i];
      setJobs(c=>c.map(j=>j.id===pitch.id?{...j,status:"building",message:"Film Room is assembling this reel now…"}:j));
      try{
        await callBuild(pitch.id,i+1); ready++;
        setJobs(c=>c.map(j=>j.id===pitch.id?{...j,status:"ready",message:"Editor-ready recipe built."}:j));
      }catch(e:any){
        setJobs(c=>c.map(j=>j.id===pitch.id?{...j,status:"failed",message:e?.message??"Build failed"}:j));
      }
    }
    setLoading(false);
    if(ready>0)router.refresh();
    if(ready<chosen.length)setError(`${ready}/${chosen.length} reels built successfully. ${chosen.length-ready} failed — swap in an alternate if needed.`);
  }

  function card(pitch:Pitch,index:number){
    const active=selectedSet.has(pitch.id), meta=pitch.score_breakdown??{};
    const rec=meta.recommendation??meta.story?.recommendation??(index===0?"PRIMARY":index===1?"SECONDARY":"ALTERNATE");
    const isPick=rec!=="ALTERNATE";
    const teams=Array.isArray(meta.teams)?meta.teams:meta.story?.teams??[];
    const players=Array.isArray(meta.players)?meta.players:meta.story?.players??[];
    const year=meta.year??meta.story?.year??"—";
    const len=meta.anticipated_length??meta.story?.anticipatedLength??"20–30 sec";
    const template=meta.template??meta.story?.template??"STORY";
    const opening=meta.opening_concept??meta.story?.openingConcept;
    const clipPlan=meta.clip_plan??meta.story?.clipPlan;
    const reason=meta.recommendation_reason??meta.story?.recommendationReason??meta.why_today??"Strong Film Room idea.";
    return <button key={pitch.id} onClick={()=>toggle(pitch.id)} disabled={loading} className={`text-left panel pitch-card p-6 ${isPick?"brain-pick-card":""} ${active?"ring-2 ring-jelly/35 bg-sidecar/50 -translate-y-1":"hover:bg-white"}`}>
      <div className="flex items-center justify-between gap-3 mb-4"><div className="flex items-center gap-2 flex-wrap"><span className={isPick?"brain-badge":"alt-badge"}>{isPick?`✦ BRAIN PICK · POST ${rec==="PRIMARY"?"01":"02"}`:`ALTERNATE ${String(Math.max(1,index-1)).padStart(2,"0")}`}</span><span className="format-chip">{formatNames[template]??template}</span></div><span className={`h-6 w-6 grid place-items-center rounded-full border text-xs ${active?"border-jelly bg-jelly text-white scale-110":"border-rule bg-white text-transparent"}`}>✓</span></div>
      <h3 className="font-display text-2xl tracking-wide text-ink mb-2">{pitch.headline}</h3>
      <p className="text-sm text-dim leading-6 mb-4">{pitch.summary}</p>
      {isPick&&<div className="recommendation-box"><div className="data-label text-jelly">WHY THE BRAIN PICKED THIS</div><p>{reason}</p></div>}
      <div className="grid grid-cols-2 gap-3 my-4 text-xs"><div className="data-cell"><div className="data-label">TEAMS / SCHOOL</div><div className="text-ink font-medium">{teams.length?teams.join(" vs. "):"TBD"}</div></div><div className="data-cell warm"><div className="data-label">ERA</div><div>{year}</div></div><div className="data-cell col-span-2"><div className="data-label">PEOPLE TO KNOW</div><div>{players.length?players.join(" · "):"No specific player required"}</div></div></div>
      {opening&&<div className="intel-strip"><span>OPEN</span><p>{opening}</p></div>}{clipPlan&&<div className="intel-strip"><span>EDIT</span><p>{clipPlan}</p></div>}
      <div className="border-t border-rule pt-4 mt-4"><div className="flex items-center justify-between text-xs font-mono tracking-wider"><span className="text-jelly">EST. {len}</span><span className="text-dim">EDITORIAL {Number(pitch.score??0).toFixed(1)}</span></div>{isPick&&<div className="score-grid mt-3"><span>GROWTH <b>{Number(meta.growth_score??0).toFixed(1)}</b></span><span>ENTERTAIN <b>{Number(meta.entertainment_score??0).toFixed(1)}</b></span><span>BRAND <b>{Number(meta.brand_score??0).toFixed(1)}</b></span></div>}</div>
    </button>;
  }

  const picks=pitches.filter((p,i)=>["PRIMARY","SECONDARY"].includes(p.score_breakdown?.recommendation??p.score_breakdown?.story?.recommendation??(i<2?(i===0?"PRIMARY":"SECONDARY"):"ALTERNATE")));
  const alts=pitches.filter(p=>!picks.some(x=>x.id===p.id));
  const pairing=picks[0]?.score_breakdown?.pairing_logic??picks[0]?.score_breakdown?.story?.pairingLogic;
  const activeJob=jobs.find(j=>j.status==="building") ?? jobs.find(j=>j.status==="queued") ?? jobs[jobs.length-1];

  const overlay=loading&&typeof document!=="undefined"?createPortal(
    <div className="fixed inset-0 z-[9999] intelligence-overlay flex items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-5xl build-lab my-auto">
        <div className="build-aurora"/><div className="scanline"/>
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-0 relative z-10">
          <div className="p-7 md:p-10 border-b lg:border-b-0 lg:border-r border-rule">
            <div className="flex items-center justify-between mb-8"><div><div className="label-eyebrow mb-2">FILM ROOM / ASSEMBLY ENGINE</div><div className="font-display text-3xl md:text-4xl tracking-wide text-ink">BUILDING THE REEL</div></div><div className="radar-core"><span/></div></div>
            <div className="assembly-stage">
              <div className={`assembly-piece piece-hook ${phase>=0?"locked":""}`}><span>HOOK</span></div>
              <div className={`assembly-piece piece-source ${phase>=1?"locked":""}`}><span>SOURCE</span></div>
              <div className={`assembly-piece piece-moment ${phase>=2?"locked":""}`}><span>MOMENTS</span></div>
              <div className={`assembly-piece piece-edit ${phase>=3?"locked":""}`}><span>EDIT</span></div>
              <div className={`assembly-piece piece-final ${phase>=4?"locked":""}`}><span>REEL</span></div>
              <div className="assembly-orbit orbit-one"/><div className="assembly-orbit orbit-two"/>
              <div className="assembly-spark spark-a"/><div className="assembly-spark spark-b"/><div className="assembly-spark spark-c"/>
            </div>
            <div className="mt-8 flex items-start gap-4"><div className="phase-index">{String(phase+1).padStart(2,"0")}</div><div><div className="font-mono text-[10px] tracking-[.18em] text-jelly mb-1">{buildPhases[phase].label}</div><div className="text-sm text-dim leading-6 max-w-md">{buildPhases[phase].detail}</div></div></div>
            <div className="phase-track mt-7">{buildPhases.map((p,i)=><div key={p.label} className={`phase-node ${i<phase?"done":i===phase?"active":""}`}><span/>{p.label}</div>)}</div>
          </div>

          <div className="p-7 md:p-10 bg-white/45">
            <div className="label-eyebrow mb-5">LIVE BUILD QUEUE</div>
            <div className="space-y-3">{jobs.map((job,i)=><div key={job.id} className={`job-pill ${job.status}`}><div className="job-number">{String(i+1).padStart(2,"0")}</div><div className="min-w-0 flex-1"><div className="font-display text-lg tracking-wide text-ink truncate">{job.headline}</div><div className="text-xs text-dim mt-1">{job.status==="building"?buildPhases[phase].detail:job.message??"Waiting in queue…"}</div></div><div className="job-status">{job.status==="ready"?"✓":job.status==="failed"?"×":job.status==="building"?"●":"○"}</div></div>)}</div>
            <div className="build-readout mt-7"><div><span>ACTIVE</span><b>{activeJob?.headline??"Preparing build…"}</b></div><div><span>ENGINE</span><b>FILM ROOM 01</b></div><div><span>STATE</span><b>{buildPhases[phase].label}</b></div></div>
            <div className="mt-7 text-[10px] font-mono tracking-[.15em] text-dim leading-5">THE INTERFACE IS VISUALIZING THE BUILD WHILE THE SERVER SEARCHES, GROUNDS AND ASSEMBLES EACH REEL. COMPLETED PIECES LOCK INTO PLACE AS THE RECIPE TAKES SHAPE.</div>
          </div>
        </div>
      </div>
    </div>,document.body):null;

  return <><div className="space-y-7">
    <div className="soft-card p-6 flex items-end justify-between gap-5"><div><div className="label-eyebrow mb-1">FILM ROOM / EDITORIAL DESK</div><h2 className="font-display text-3xl tracking-wide text-ink">TODAY'S RECOMMENDED TWO</h2><p className="text-dim text-sm mt-1 max-w-2xl">The Brain is optimizing for follower growth, entertainment and long-term Film Room identity — not just whatever is trending.</p></div><div className="text-right shrink-0"><div className="font-mono text-xs tracking-[.16em] text-dim mb-2">{selected.length} SELECTED · 2/DAY TARGET</div><button onClick={buildSelected} disabled={!selected.length||loading} className="btn-primary disabled:opacity-40">Build {selected.length} Selected Reel{selected.length===1?"":"s"}</button></div></div>
    {pairing&&<div className="pairing-note"><span>PAIRING LOGIC</span>{pairing}</div>}
    {error&&<div className="rounded-3xl border border-milan/20 bg-milan/5 px-5 py-4 text-signal text-sm">{error}</div>}
    <div className="grid md:grid-cols-2 gap-5">{picks.map((p,i)=>card(p,i))}</div>
    <div><div className="flex items-end justify-between mb-3"><div><div className="label-eyebrow">BACKUP BOARD</div><h3 className="font-display text-2xl tracking-wide text-ink">THREE ALTERNATE PITCHES</h3></div><div className="text-xs text-dim">Swap one in · or build a third post</div></div><div className="grid lg:grid-cols-3 gap-4">{alts.map((p,i)=>card(p,i+2))}</div></div>
    <button onClick={generateOneMore} disabled={moreLoading||loading} className="w-full min-h-[150px] rounded-[2rem] border border-dashed border-jelly/30 bg-sinbad/8 hover:bg-sinbad/14 group flex items-center justify-center gap-5 p-7"><span className="orb-button">+</span><div className="text-left"><div className="font-display text-xl tracking-wide text-ink">{moreLoading?"THINKING…":"GENERATE ANOTHER ANGLE"}</div><div className="text-xs text-dim mt-1">Ask the editorial desk for one more option without replacing today's board.</div></div></button>
  </div>{overlay}</>;
}
