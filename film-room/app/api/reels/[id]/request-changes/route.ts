import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params; const body=await req.json().catch(()=>({})); const db=supabaseAdmin();
 const note=String(body.note??"").trim(); const category=String(body.category??"editorial");
 const {error}=await db.from("reels").update({status:"changes_requested",review_note:note||null,updated_at:new Date().toISOString()}).eq("id",id);
 if(error)return NextResponse.json({error:error.message},{status:500});
 if(note) await db.from("editorial_feedback").insert({reel_id:id,category,note});
 return NextResponse.json({ok:true});
}
