"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Pitch = { id:string; headline:string; sport:string; summary:string|null; score:number|null; score_breakdown:any; selected:boolean };
type ManualSource = { video_id:string; title:string; channel_title:string; url:string };
type JobState = {
  id:string;
  headline:string;
  slot:number;
  status:"queued"|"building"|"ready"|"failed";
  message?:string;
  needsManualTranscript?:boolean;
  manualSource?:ManualSource|null;
  manualTranscript?:string;
};

type BuildError = Error & { payload?:any };

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

  async function callBuild(id:string,slot:number,manualTranscript?:string,manualVideoId?:string){
    const res=await fetch("/api/build-one",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id,slot,manualTranscript,manualVideoId})
    });
    const raw=await res.text(); let data:any={};
    try{data=raw?JSON.parse(raw):{}}catch{throw new Error(`Server returned an unreadable response (${res.status}).`)}
    if(!res.ok||data?.error){
      const err = new Error(data?.error??`Build failed (${res.status})`) as BuildError;
      err.payload = data;
      throw err;
    }
    return data;
  }

  async function buildSelected(){
    if(selected.length<1)return;
    setLoading(true); setError(null);
    const chosen=selected.map(id=>pitches.find(p=>p.id===id)!).filter(Boolean);
    setJobs(chosen.map((p,i)=>({id:p.id,headline:p.headline,slot:i+1,status:"queued"})));
    let ready=0;
    for(let i=0;i<chosen.length;i++){
      const pitch=chosen[i];
      setJobs(c=>c.map(j=>j.id===pitch.id?{...j,status:"building",message:"Film Room is assembling this reel now…",needsManualTranscript:false}:j));
      try{
        await callBuild(pitch.id,i+1); ready++;
        setJobs(c=>c.map(j=>j.id===pitch.id?{...j,status:"ready",message:"Editor-ready recipe built."}:j));
      }catch(e:any){
        const payload=(e as BuildError)?.payload;
        setJobs(c=>c.map(j=>j.id===pitch.id?{
          ...j,
          status:"failed",
          message:e?.message??"Build failed",
          needsManualTranscript:Boolean(payload?.needs_manual_transcript),
          manualSource:payload?.manual_source??null,
          manualTranscript:j.manualTranscript??""
        }:j));
      }
    }
    setLoading(false);
    if(ready>0)router.refresh();
    if(ready<chosen.length)setError(`${ready}/${chosen.length} reels built automatically. Anything marked SOURCE HELP can be recovered with a timestamped transcript — you do not need to abandon the pitch.`);
  }

  function updateManualTranscript(id:string,value:string){
    setJobs(c=>c.map(j=>j.id===id?{...j,manualTranscript:value}:j));
  }

  async function retryManual(job:JobState){
    if(!job.manualTranscript?.trim()) return;
    setError(null); setLoading(true);
    setJobs(c=>c.map(j=>j.id===job.id?{...j,status:"building",message:"Using the editor transcript to ground the reel…"}:j));
    try{
      await callBuild(job.id,job.slot,job.manualTranscript,job.manualSource?.video_id);
      setJobs(c=>c.map(j=>j.id===job.id?{...j,status:"ready",message:"Editor-ready recipe built from the supplied transcript.",needsManualTranscript:false}:j));
      router.refresh();
    }catch(e:any){
      const payload=(e as BuildError)?.payload;
      setJobs(c=>c.map(j=>j.id===job.id?{...j,status:"failed",message:e?.message??"Manual transcript build failed",needsManualTranscript:Boolean(payload?.needs_manual_transcript??true),manualSource:payload?.manual_source??j.manualSource}:j));
      setError(e?.message??"Manual transcript build failed.");
    }finally{setLoading(false)}
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
  const manualHelpJobs=jobs.filter(j=>j.needsManualTranscript);

  const overlay=loading&&typeof document!=="undefined"?createPortal(
    <div className="fixed inset-0 z-[9999] intelligence-overlay flex items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-5xl build-lab build-lab-3d my-auto">
        <div className="build-aurora"/><div className="scanline"/>
        <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-0 relative z-10">
          <div className="p-7 md:p-10 border-b lg:border-b-0 lg:border-r border-rule">
            <div className="flex items-center justify-between mb-8"><div><div className="label-eyebrow mb-2">FILM ROOM / ASSEMBLY ENGINE</div><div className="font-display text-3xl md:text-4xl tracking-wide text-ink">BUILDING THE REEL</div></div><div className="radar-core"><span/></div></div>
            <div className="assembly-stage assembly-stage-3d">
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

          <div className="p-7 md:p-10 bg-white/45 build-side-3d">
            <div className="label-eyebrow mb-5">LIVE BUILD QUEUE</div>
            <div className="space-y-3">{jobs.map((job,i)=><div key={job.id} style={{animationDelay:`${i*140}ms`}} className={`job-pill job-pill-3d ${job.status}`}><div className="job-number">{String(i+1).padStart(2,"0")}</div><div className="min-w-0 flex-1"><div className="font-display text-lg tracking-wide text-ink truncate">{job.headline}</div><div className="text-xs text-dim mt-1">{job.status==="building"?buildPhases[phase].detail:job.message??"Waiting in queue…"}</div></div><div className="job-status">{job.status==="ready"?"✓":job.status==="failed"?"×":job.status==="building"?"●":"○"}</div></div>)}</div>
            <div className="build-readout mt-7"><div><span>ACTIVE</span><b>{activeJob?.headline??"Preparing build…"}</b></div><div><span>ENGINE</span><b>FILM ROOM 01</b></div><div><span>STATE</span><b>{buildPhases[phase].label}</b></div></div>
            <div className="mt-7 text-[10px] font-mono tracking-[.15em] text-dim leading-5">THE INTERFACE IS VISUALIZING THE BUILD WHILE THE SERVER SEARCHES, GROUNDS AND ASSEMBLES EACH REEL. COMPLETED PIECES FLY IN FROM THE FIELD AND LOCK INTO THE FINAL STRUCTURE.</div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .intelligence-overlay{perspective:1600px;perspective-origin:50% 46%}
        .build-lab-3d{transform-style:preserve-3d;animation:labEnter3d .8s cubic-bezier(.16,1,.3,1) both;box-shadow:0 55px 140px rgba(37,121,155,.24),0 18px 45px rgba(23,49,58,.11)}
        .assembly-stage-3d{perspective:1200px;transform-style:preserve-3d;overflow:visible!important;transform:rotateX(7deg) rotateY(-4deg);box-shadow:inset 0 -22px 55px rgba(37,121,155,.05),0 30px 60px rgba(23,49,58,.08)}
        .assembly-stage-3d:after{content:"";position:absolute;left:9%;right:9%;bottom:-34px;height:70px;border-radius:50%;background:radial-gradient(ellipse,rgba(23,49,58,.16),transparent 68%);filter:blur(13px);transform:rotateX(72deg) translateZ(-55px);pointer-events:none}
        .assembly-stage-3d .assembly-piece{transform-style:preserve-3d;will-change:transform,opacity,filter;backface-visibility:hidden;transition:none}
        .assembly-stage-3d .piece-hook{--fx:-82vw;--fy:-32vh;--fz:-520px;--frx:52deg;--fry:-72deg;--frz:-28deg}
        .assembly-stage-3d .piece-source{--fx:88vw;--fy:-38vh;--fz:-620px;--frx:-38deg;--fry:80deg;--frz:34deg}
        .assembly-stage-3d .piece-moment{--fx:-74vw;--fy:48vh;--fz:-430px;--frx:-62deg;--fry:-48deg;--frz:42deg}
        .assembly-stage-3d .piece-edit{--fx:79vw;--fy:44vh;--fz:-560px;--frx:48deg;--fry:62deg;--frz:-38deg}
        .assembly-stage-3d .piece-final{--fx:0;--fy:0;--fz:-900px;--frx:70deg;--fry:120deg;--frz:-40deg}
        .assembly-stage-3d .assembly-piece:not(.locked){opacity:0;transform:translate3d(var(--fx),var(--fy),var(--fz)) rotateX(var(--frx)) rotateY(var(--fry)) rotateZ(var(--frz)) scale(.45);filter:blur(7px)}
        .assembly-stage-3d .assembly-piece.locked{animation:pieceFly3d 1.45s cubic-bezier(.12,.84,.18,1) both, pieceFloat3d 4.8s ease-in-out 1.45s infinite;box-shadow:0 28px 58px rgba(23,49,58,.14),inset 0 1px 0 rgba(255,255,255,.85)}
        .assembly-stage-3d .piece-final.locked{animation:pieceFly3d 1.6s cubic-bezier(.12,.84,.18,1) both, finalHover3d 4.2s ease-in-out 1.6s infinite;box-shadow:0 0 0 13px rgba(37,121,155,.06),0 38px 75px rgba(37,121,155,.32)}
        .assembly-stage-3d .piece-hook.locked{animation-delay:0ms,1.45s}.assembly-stage-3d .piece-source.locked{animation-delay:60ms,1.51s}.assembly-stage-3d .piece-moment.locked{animation-delay:80ms,1.53s}.assembly-stage-3d .piece-edit.locked{animation-delay:90ms,1.54s}.assembly-stage-3d .piece-final.locked{animation-delay:100ms,1.7s}
        .assembly-stage-3d .assembly-orbit{transform-style:preserve-3d;box-shadow:0 0 26px rgba(37,121,155,.05)}
        .assembly-stage-3d .orbit-one{transform:rotateX(68deg) rotateZ(14deg);animation:orbit3dOne 8s linear infinite}.assembly-stage-3d .orbit-two{transform:rotateY(63deg) rotateZ(-18deg);animation:orbit3dTwo 10s linear infinite}
        .build-side-3d{transform:translateZ(10px)}
        .job-pill-3d{transform-style:preserve-3d;animation:queueFlyIn .7s cubic-bezier(.16,1,.3,1) both;box-shadow:0 15px 36px rgba(23,49,58,.07)}
        .job-pill-3d.building{transform:translateZ(18px);box-shadow:0 22px 46px rgba(37,121,155,.12)}
        @keyframes labEnter3d{0%{opacity:0;transform:translateZ(-500px) rotateX(11deg) scale(.88)}100%{opacity:1;transform:translateZ(0) rotateX(0) scale(1)}}
        @keyframes pieceFly3d{0%{opacity:0;transform:translate3d(var(--fx),var(--fy),var(--fz)) rotateX(var(--frx)) rotateY(var(--fry)) rotateZ(var(--frz)) scale(.42);filter:blur(8px)}55%{opacity:1;filter:blur(0);transform:translate3d(0,0,45px) rotateX(-7deg) rotateY(8deg) rotateZ(-2deg) scale(1.08)}76%{transform:translate3d(0,0,-10px) rotateX(3deg) rotateY(-3deg) rotateZ(1deg) scale(.98)}100%{opacity:1;filter:none;transform:translate3d(0,0,12px) rotateX(0) rotateY(0) rotateZ(0) scale(1)}}
        @keyframes pieceFloat3d{0%,100%{transform:translate3d(0,0,12px) rotateX(0) rotateY(0)}50%{transform:translate3d(0,-7px,27px) rotateX(3deg) rotateY(-3deg)}}
        @keyframes finalHover3d{0%,100%{transform:translate3d(0,0,28px) rotateY(-4deg)}50%{transform:translate3d(0,-10px,52px) rotateY(5deg) rotateX(3deg)}}
        @keyframes queueFlyIn{0%{opacity:0;transform:translate3d(45vw,20px,-240px) rotateY(-28deg) scale(.82)}100%{opacity:1;transform:translate3d(0,0,0) rotateY(0) scale(1)}}
        @keyframes orbit3dOne{to{transform:rotateX(68deg) rotateZ(374deg)}}@keyframes orbit3dTwo{to{transform:rotateY(63deg) rotateZ(-378deg)}}
        @media(max-width:768px){.assembly-stage-3d{transform:rotateX(4deg) rotateY(-2deg)}.assembly-stage-3d .piece-hook{--fx:-105vw}.assembly-stage-3d .piece-source{--fx:105vw}.assembly-stage-3d .piece-moment{--fx:-105vw}.assembly-stage-3d .piece-edit{--fx:105vw}}
        @media(prefers-reduced-motion:reduce){.assembly-stage-3d .assembly-piece.locked,.job-pill-3d,.build-lab-3d{animation:none!important;transform:none!important;opacity:1!important;filter:none!important}}
      `}</style>
    </div>,document.body):null;

  return <><div className="space-y-7">
    <div className="soft-card p-6 flex items-end justify-between gap-5"><div><div className="label-eyebrow mb-1">FILM ROOM / EDITORIAL DESK</div><h2 className="font-display text-3xl tracking-wide text-ink">TODAY'S RECOMMENDED TWO</h2><p className="text-dim text-sm mt-1 max-w-2xl">The Brain is optimizing for follower growth, entertainment and long-term Film Room identity — not just whatever is trending.</p></div><div className="text-right shrink-0"><div className="font-mono text-xs tracking-[.16em] text-dim mb-2">{selected.length} SELECTED · 2/DAY TARGET</div><button onClick={buildSelected} disabled={!selected.length||loading} className="btn-primary disabled:opacity-40">Build {selected.length} Selected Reel{selected.length===1?"":"s"}</button></div></div>
    {pairing&&<div className="pairing-note"><span>PAIRING LOGIC</span>{pairing}</div>}
    {error&&<div className="rounded-3xl border border-milan/20 bg-milan/5 px-5 py-4 text-signal text-sm">{error}</div>}
    {manualHelpJobs.length>0&&<div className="space-y-4">{manualHelpJobs.map(job=><div key={job.id} className="soft-card p-6 border-milan/10"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div><div className="label-eyebrow text-jelly">SOURCE HELP · OPTIONAL MANUAL FALLBACK</div><h3 className="font-display text-2xl tracking-wide text-ink mt-1">{job.headline}</h3><p className="text-sm text-dim mt-2 max-w-2xl">Automatic grounding could not read this source. Paste a timestamped transcript and Film Room will resume the same reel instead of making you choose another idea.</p></div>{job.manualSource&&<a href={job.manualSource.url} target="_blank" rel="noreferrer" className="btn-ghost shrink-0">Open source ↗</a>}</div>{job.manualSource&&<div className="data-cell mt-4"><div className="data-label">SOURCE FILM ROOM CHOSE</div><div className="text-sm text-ink">{job.manualSource.title}</div><div className="text-xs text-dim mt-1">{job.manualSource.channel_title}</div></div>}<textarea value={job.manualTranscript??""} onChange={e=>updateManualTranscript(job.id,e.target.value)} rows={8} placeholder={"Paste timestamped transcript here…\n00:12 Player talks about the rivalry\n00:18 We knew the stadium would be loud\n00:27 I saw the safety come down"} className="mt-4 w-full rounded-[1.5rem] border border-jelly/15 bg-white px-4 py-4 font-mono text-xs leading-6 text-ink shadow-inner focus:border-jelly/40"/><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4"><div className="text-xs text-dim">Tip: YouTube's “Show transcript” timestamps work. Film Room needs timestamps so it never invents clip locations.</div><button onClick={()=>retryManual(job)} disabled={!job.manualTranscript?.trim()||loading} className="btn-primary disabled:opacity-40 shrink-0">Resume This Reel</button></div></div>)}</div>}
    <div className="grid md:grid-cols-2 gap-5">{picks.map((p,i)=>card(p,i))}</div>
    <div><div className="flex items-end justify-between mb-3"><div><div className="label-eyebrow">BACKUP BOARD</div><h3 className="font-display text-2xl tracking-wide text-ink">THREE ALTERNATE PITCHES</h3></div><div className="text-xs text-dim">Swap one in · or build a third post</div></div><div className="grid lg:grid-cols-3 gap-4">{alts.map((p,i)=>card(p,i+2))}</div></div>
    <button onClick={generateOneMore} disabled={moreLoading||loading} className="w-full min-h-[150px] rounded-[2rem] border border-dashed border-jelly/30 bg-sinbad/8 hover:bg-sinbad/14 group flex items-center justify-center gap-5 p-7"><span className="orb-button">+</span><div className="text-left"><div className="font-display text-xl tracking-wide text-ink">{moreLoading?"THINKING…":"GENERATE ANOTHER ANGLE"}</div><div className="text-xs text-dim mt-1">Ask the editorial desk for one more option without replacing today's board.</div></div></button>
  </div>{overlay}</>;
}
