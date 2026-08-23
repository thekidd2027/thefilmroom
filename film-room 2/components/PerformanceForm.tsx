"use client";
import {useState} from "react";
export default function PerformanceForm({reelId,initial}:{reelId:string,initial?:any}){
 const [v,setV]=useState<any>({views:0,likes:0,comments:0,shares:0,saves:0,watch_time_seconds:0,completion_rate:0,profile_visits:0,follows:0,...initial}); const [msg,setMsg]=useState("");
 async function save(){setMsg("Saving…");const r=await fetch(`/api/reels/${reelId}/performance`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)});const d=await r.json();setMsg(d.error||"Saved");}
 const fields=["views","likes","comments","shares","saves","watch_time_seconds","completion_rate","profile_visits","follows"];
 return <div><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{fields.map(f=><label key={f} className="text-xs text-dim">{f.replaceAll("_"," ")}<input type="number" step="any" value={v[f]} onChange={e=>setV({...v,[f]:e.target.value})} className="mt-1 w-full bg-bay2 border border-rule rounded-sm px-2 py-1.5 text-paper"/></label>)}</div><div className="flex items-center gap-2 mt-3"><button onClick={save} className="btn-go">Save performance</button><span className="text-xs text-dim">{msg}</span></div></div>
}
