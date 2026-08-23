import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params; const b=await req.json();
  const db=supabaseAdmin();
  const payload={
    reel_id:id, views:Number(b.views||0), likes:Number(b.likes||0), comments:Number(b.comments||0), shares:Number(b.shares||0),
    saves:Number(b.saves||0), watch_time_seconds:Number(b.watch_time_seconds||0), completion_rate:Number(b.completion_rate||0),
    profile_visits:Number(b.profile_visits||0), follows:Number(b.follows||0), measured_at:new Date().toISOString()
  };
  const {error}=await db.from("performance").upsert(payload,{onConflict:"reel_id"});
  if(error)return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({ok:true});
}
