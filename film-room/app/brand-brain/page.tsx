import { getBrandBrain } from "@/lib/getBrandBrain";
import BrandBrainEditor from "@/components/BrandBrainEditor";
export const dynamic="force-dynamic";
export default async function BrandBrainPage(){const brain=await getBrandBrain(); const blocks:[string,string,unknown,string?][]=[
 ["editorialRules","Editorial rules",brain.editorialRules,"The permanent logic for fan allegiance, replacements, source timestamps, alternate angles, templates and reel length."],
 ["musicPolicy","Music identity",brain.musicPolicy,brain.musicPolicy.rationale],
 ["mediaSourcing","Media sourcing + rights",brain.mediaSourcing,brain.mediaSourcing.rationale],
 ["scoringWeights","Scoring weights",brain.scoringWeights], ["seasonalCalendar","Seasonal calendar",brain.seasonalCalendar], ["penalties","Penalties",brain.penalties], ["voice","Voice",brain.voice], ["slateSize","Slate size",brain.slateSize]
 ]; return <div className="p-8 max-w-3xl space-y-5"><div><h1 className="font-display text-3xl tracking-wide mb-2">BRAND BRAIN</h1><p className="text-dim text-sm">The AI reads these rules every time it researches and builds a Reel Job.</p></div>{blocks.map(([key,label,value,desc])=><div key={key} className="panel p-4"><div className="label-eyebrow mb-2">{label}</div>{desc&&<p className="text-sm text-dim mb-2">{desc}</p>}<BrandBrainEditor blockKey={key} value={value}/></div>)}</div>}
