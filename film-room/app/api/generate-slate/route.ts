import { NextResponse } from "next/server";
import { getBrandBrain } from "@/lib/getBrandBrain";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/requireOwner";

export const maxDuration=60;
const API="https://api.anthropic.com/v1/messages";
const MODEL=process.env.ANTHROPIC_PITCH_MODEL??"claude-haiku-4-5";
type Cat="PLAYER_SPOTLIGHT"|"TEAM_SCHOOL_SPOTLIGHT"|"MOMENT_GAME"|"STORY";
type Pitch={headline:string;sport:"football"|"basketball";summary:string;whyToday:string;viewerFeeling:string;searchQueries:string[];popularityEvidence:string[];trendSources:any[];template:Cat;fanAllegianceLogic:string;teams:string[];year:string;players:string[];anticipatedLength:string;openingConcept:string;clipPlan:string;recommendation:"PRIMARY"|"SECONDARY"|"ALTERNATE";recommendationReason:string;growthScore:number;entertainmentScore:number;brandScore:number;timelinessScore:number;editabilityScore:number;overallScore:number;pairingLogic:string};
function n(v:any,d=8){const x=Number(v);return Number.isFinite(x)?Math.max(0,Math.min(10,x)):d}
function norm(s:any):Pitch{return{headline:String(s.headline),sport:s.sport==="basketball"?"basketball":"football",summary:String(s.summary??""),whyToday:String(s.whyToday??""),viewerFeeling:String(s.viewerFeeling??"awe"),searchQueries:Array.isArray(s.searchQueries)?s.searchQueries.slice(0,5).map(String):[String(s.headline)],popularityEvidence:Array.isArray(s.popularityEvidence)?s.popularityEvidence.map(String):[],trendSources:[],template:["PLAYER_SPOTLIGHT","TEAM_SCHOOL_SPOTLIGHT","MOMENT_GAME","STORY"].includes(s.template)?s.template:"PLAYER_SPOTLIGHT",fanAllegianceLogic:String(s.fanAllegianceLogic??""),teams:Array.isArray(s.teams)?s.teams.slice(0,5).map(String):[],year:String(s.year??"—"),players:Array.isArray(s.players)?s.players.slice(0,7).map(String):[],anticipatedLength:String(s.anticipatedLength??"15–30 sec"),openingConcept:String(s.openingConcept??""),clipPlan:String(s.clipPlan??""),recommendation:["PRIMARY","SECONDARY","ALTERNATE"].includes(s.recommendation)?s.recommendation:"ALTERNATE",recommendationReason:String(s.recommendationReason??""),growthScore:n(s.growthScore),entertainmentScore:n(s.entertainmentScore),brandScore:n(s.brandScore),timelinessScore:n(s.timelinessScore),editabilityScore:n(s.editabilityScore),overallScore:n(s.overallScore),pairingLogic:String(s.pairingLogic??"")}}

const pitchItemSchema={type:"object",additionalProperties:false,required:["headline","sport","summary","whyToday","viewerFeeling","searchQueries","popularityEvidence","template","fanAllegianceLogic","teams","year","players","anticipatedLength","openingConcept","clipPlan","recommendation","recommendationReason","growthScore","entertainmentScore","brandScore","timelinessScore","editabilityScore","overallScore","pairingLogic"],properties:{headline:{type:"string"},sport:{type:"string",enum:["football","basketball"]},summary:{type:"string"},whyToday:{type:"string"},viewerFeeling:{type:"string"},searchQueries:{type:"array",items:{type:"string"}},popularityEvidence:{type:"array",items:{type:"string"}},template:{type:"string",enum:["PLAYER_SPOTLIGHT","TEAM_SCHOOL_SPOTLIGHT","MOMENT_GAME","STORY"]},fanAllegianceLogic:{type:"string"},teams:{type:"array",items:{type:"string"}},year:{type:"string"},players:{type:"array",items:{type:"string"}},anticipatedLength:{type:"string"},openingConcept:{type:"string"},clipPlan:{type:"string"},recommendation:{type:"string",enum:["PRIMARY","SECONDARY","ALTERNATE"]},recommendationReason:{type:"string"},growthScore:{type:"number"},entertainmentScore:{type:"number"},brandScore:{type:"number"},timelinessScore:{type:"number"},editabilityScore:{type:"number"},overallScore:{type:"number"},pairingLogic:{type:"string"}}};

async function generate(date:string,brain:any,memory:string):Promise<Pitch[]>{
 const key=process.env.ANTHROPIC_API_KEY;if(!key)throw new Error("ANTHROPIC_API_KEY is required.");
 const categories=(brain?.editorialRules?.templates??[]).map((x:any)=>`${x.name}: ${x.job}`).join("\n");
 const prompt=`You are the Film Room editorial director. Today is ${date}. Generate exactly FIVE elite short-form reel pitches.

NON-NEGOTIABLE:
1) ONLY men's college football and men's college basketball. NEVER women's sports, NFL, NBA or high school.
2) Follow current popularity. Whichever of football/basketball is culturally hottest may dominate all five. Never force diversity. In football season strongly favor football.
3) HIGHLIGHTS are the product. Never pitch generic crowds, marching bands, stadiums, traditions or entrances as the subject.
4) THE CAPTION IS A CONTRACT. Every primary highlight must fit the exact game/season/career/team/rivalry/moment/claim in the headline.
5) Primary highlight clips MUST be broadcast footage with original announcer commentary. Supporting fan/crowd/field-level/alternate/reaction footage may lack announcers.
6) Find the BEST highlights, not merely usable ones. The eventual recipe should rank a larger candidate pool and pull from 2+ source videos.
7) No interviews in PLAYER_SPOTLIGHT, TEAM_SCHOOL_SPOTLIGHT or MOMENT_GAME. STORY ALWAYS opens with a VERIFIED real player/coach interview and the following highlights must directly support what was said.
8) Current great content gets a timeliness boost, but evergreen greatness beats mediocre current content.
9) Exactly one PRIMARY, one SECONDARY and three ALTERNATE. The top two should be what Film Room should actually post for growth + quality + brand.
10) Learn from rejection memory and avoid rejected patterns.

FOUR AND ONLY FOUR CATEGORIES:
${categories}

MUSIC WORLD: ${(brain?.musicPolicy?.soundPalette??[]).join("; ")}. Announcer calls remain audible and important.
REJECTION MEMORY:
${memory||"None yet."}

For each pitch, openingConcept and clipPlan must demonstrate caption-scope discipline and announcer-audio intent. Search queries should seek broadcast highlights and alternate angles. Score honestly; 9.3+ overall is rare and means genuinely fire/shareable.`;

 const r=await fetch(API,{method:"POST",headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:MODEL,max_tokens:2600,temperature:.6,tools:[{name:"submit_film_room_pitches",description:"Submit the five Film Room reel pitches in structured form.",input_schema:{type:"object",additionalProperties:false,required:["stories"],properties:{stories:{type:"array",minItems:5,maxItems:5,items:pitchItemSchema}}}}],tool_choice:{type:"tool",name:"submit_film_room_pitches"},messages:[{role:"user",content:prompt}]})});
 const p=await r.json();if(!r.ok)throw new Error(p?.error?.message??`Anthropic request failed (${r.status})`);
 const toolBlock=(p?.content??[]).find((b:any)=>b?.type==="tool_use"&&b?.name==="submit_film_room_pitches");
 if(!toolBlock?.input?.stories)throw new Error("Brain did not return structured pitches.");
 const stories:Pitch[]=(Array.isArray(toolBlock.input.stories)?toolBlock.input.stories:[]).filter((s:any)=>s?.headline&&(s.sport==="football"||s.sport==="basketball")).slice(0,5).map(norm);
 if(stories.length!==5)throw new Error("Brain did not return five valid pitches.");
 let pri=stories.filter(s=>s.recommendation==="PRIMARY"),sec=stories.filter(s=>s.recommendation==="SECONDARY");
 if(pri.length!==1||sec.length!==1){const sorted=[...stories].sort((a,b)=>b.overallScore-a.overallScore);sorted.forEach((s,i)=>s.recommendation=i===0?"PRIMARY":i===1?"SECONDARY":"ALTERNATE");return sorted}
 return[...pri,...sec,...stories.filter(s=>s.recommendation==="ALTERNATE").sort((a,b)=>b.overallScore-a.overallScore)]
}

export async function POST(){try{await requireOwner();const db=supabaseAdmin();const brain=await getBrandBrain();const today=new Date().toISOString().slice(0,10);const{data:rejected}=await db.from("reels").select("headline,review_note,recipe,status").eq("status","rejected").order("updated_at",{ascending:false}).limit(40);const memory=(rejected??[]).map((r:any)=>`- ${r.headline}${r.review_note?` — ${r.review_note}`:""}${r.recipe?.template?` [${r.recipe.template}]`:""}`).join("\n");const stories=await generate(today,brain,memory);const rows=stories.map(s=>({slate_date:today,candidate_kind:"pitch",headline:s.headline,sport:s.sport,summary:s.summary,source_urls:[],score:s.overallScore,score_breakdown:{story:s,kind:"pitch",why_today:s.whyToday,viewer_feeling:s.viewerFeeling,template:s.template,fan_allegiance_logic:s.fanAllegianceLogic,teams:s.teams,year:s.year,players:s.players,anticipated_length:s.anticipatedLength,opening_concept:s.openingConcept,clip_plan:s.clipPlan,recommendation:s.recommendation,recommendation_reason:s.recommendationReason,pairing_logic:s.pairingLogic,growth_score:s.growthScore,entertainment_score:s.entertainmentScore,brand_score:s.brandScore,timeliness_score:s.timelinessScore,editability_score:s.editabilityScore},selected:false,rejection_reason:null}));const{error:del}=await db.from("candidates").delete().eq("slate_date",today).eq("candidate_kind","pitch");if(del)throw del;const{data,error}=await db.from("candidates").insert(rows).select();if(error)throw error;return NextResponse.json({pitches:data??[],count:data?.length??0})}catch(e:any){console.error("Pitch generation failed",e);const status=e?.message==="UNAUTHORIZED"?401:e?.message==="FORBIDDEN"?403:500;return NextResponse.json({error:status===401?"Please sign in again.":status===403?"Owner access required.":e?.message??"Pitch generation failed"},{status})}}
