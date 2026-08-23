import {NextResponse} from "next/server";
export async function GET(){
 const vars=["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","OPENAI_API_KEY","YOUTUBE_API_KEY","SUPADATA_API_KEY"];
 return NextResponse.json({services:vars.map(name=>({name,configured:Boolean(process.env[name])}))});
}
