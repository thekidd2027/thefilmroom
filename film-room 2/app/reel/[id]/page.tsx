import { supabaseAdmin } from "@/lib/supabaseServer";
import { Reel, Editor, ClipRef } from "@/lib/types";
import { notFound } from "next/navigation";
import { StatusPill, ScoreBadge } from "@/components/Badges";
import AssignPicker from "@/components/AssignPicker";
import ChecklistBox from "@/components/ChecklistBox";
import UploadBox from "@/components/UploadBox";
import PerformanceForm from "@/components/PerformanceForm";

export const dynamic="force-dynamic";
export default async function ReelJobPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const db=supabaseAdmin();
 const [{data:reel},{data:editors},{data:performance}]=await Promise.all([
  db.from("reels").select("*").eq("id",id).single(), db.from("editors").select("*").order("display_name"), db.from("performance").select("*").eq("reel_id",id).maybeSingle()
 ]);
 if(!reel)notFound(); const r=reel as Reel; const editorList=(editors??[]) as Editor[]; const sr=r.story_research;
 return <div className="p-6 md:p-8 max-w-4xl space-y-5">
  <div><div className="label-eyebrow mb-1">Reel Job · Slot {r.slot} · {r.template_name??""}</div><div className="flex items-start justify-between gap-4"><h1 className="font-display text-2xl tracking-wide">{r.headline}</h1><ScoreBadge score={r.predicted_interest}/></div><div className="mt-2 flex gap-2"><StatusPill status={r.status}/><span className="text-dim text-sm capitalize">{r.sport}</span></div></div>
  {sr&&<Section title="Story"><p className="font-medium">{sr.why_today}</p><p className="text-dim text-sm mt-2">Viewer should feel: {sr.viewer_feeling}</p><p className="text-dim text-sm mt-2">Fan logic: {sr.fan_allegiance_logic}</p>{sr.popularity_evidence?.length>0&&<ul className="mt-3 text-sm list-disc pl-5">{sr.popularity_evidence.map((x,i)=><li key={i}>{x}</li>)}</ul>}{sr.trend_sources?.length>0&&<div className="mt-3 flex flex-wrap gap-2">{sr.trend_sources.map((x,i)=><a key={i} href={x.url} target="_blank" className="text-wire text-xs hover:underline">{x.label}</a>)}</div>}</Section>}
  <Section title="Primary clips — use in this order"><div className="space-y-3">{(r.primary_clips??(r.clip_primary?[r.clip_primary]:[])).map((c,i)=><ClipCard key={i} clip={c} index={i+1}/>)}</div></Section>
  <Section title="Replacement clips — only if needed"><div className="space-y-3">{(r.clip_backups??[]).map((c,i)=><ClipCard key={i} clip={c} index={i+1} replacement/>)}</div></Section>
  <Section title="Edit recipe"><ol className="space-y-4">{(r.edit_notes??[]).map((s,i)=><li key={i} className="text-sm border-b border-rule/60 pb-3 last:border-0"><div className="font-medium">{s.order}. {s.shot}</div><a className="text-wire font-mono text-xs" target="_blank" href={s.direct_url}>Open source at exact timestamp</a><div className="text-dim mt-1">{s.purpose}</div>{s.on_screen_text&&<div className="mt-1">Text: <span className="font-medium">{s.on_screen_text}</span></div>}<div className="mt-1 text-dim">Audio: {s.audio_note||"Follow music bed"}</div>{s.keyframes?.length>0&&<div className="mt-2 text-xs text-dim">Keyframes: {s.keyframes.map((k,j)=><span key={j} className="mr-2">{k.at_seconds}s · x{k.x} y{k.y} · {k.scale}% ({k.note})</span>)}</div>}</li>)}</ol></Section>
  <Section title="3 song options"><div className="space-y-2">{(r.music_options??[]).map((m,i)=><div key={i} className="text-sm"><span className="font-medium">#{m.rank} {m.title}</span> — {m.artist}<div className="text-dim">{m.note}</div></div>)}</div></Section>
  <Section title="Words + caption"><div className="text-sm"><div><span className="text-dim">Cover:</span> {r.cover_text||"—"}</div><div className="mt-1"><span className="text-dim">Caption:</span> {r.caption||"—"}</div></div></Section>
  <Section title="Assignment"><AssignPicker reelId={r.id} editors={editorList} currentEditorId={r.assigned_to}/></Section>
  <Section title="Editor checklist"><ChecklistBox reelId={r.id} items={r.checklist??[]}/></Section>
  <Section title="Upload finished MP4"><UploadBox reelId={r.id} existingPath={r.final_video_url}/></Section>
  {r.status==="published"&&<Section title="Performance feedback"><PerformanceForm reelId={r.id} initial={performance}/></Section>}
 </div>
}
function ClipCard({clip,index,replacement=false}:{clip:ClipRef,index:number,replacement?:boolean}){return <div className="bg-bay2 border border-rule rounded-sm p-3 text-sm"><div className="flex justify-between gap-3"><div><span className="font-mono text-dim mr-2">{replacement?`R${index}`:`${index}`}</span><span className="font-medium">{clip.moment||clip.title}</span></div><a target="_blank" href={clip.direct_url} className="btn-ghost shrink-0">Open @ time</a></div><div className="text-dim mt-1">{clip.title} · {clip.channel_title}</div><div className="mt-1">Job: {clip.story_function}</div>{clip.camera_angle&&<div className="text-dim">Angle: {clip.camera_angle}</div>}{clip.can_replace?.length?<div className="text-dim">Can replace primary: {clip.can_replace.join(", ")}</div>:null}{clip.rights_note&&<div className="mt-1 text-xs text-signal">Rights: {clip.rights_note}</div>}</div>}
function Section({title,children}:{title:string;children:React.ReactNode}){return <div className="panel p-4"><div className="label-eyebrow mb-2">{title}</div>{children}</div>}
