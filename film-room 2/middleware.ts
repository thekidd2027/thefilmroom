import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request:NextRequest){
  let response=NextResponse.next({request});
  const supabase=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{
    cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll:(items)=>{ items.forEach(({name,value})=>request.cookies.set(name,value)); response=NextResponse.next({request}); items.forEach(({name,value,options})=>response.cookies.set(name,value,options)); }
    }
  });
  const {data:{user}}=await supabase.auth.getUser();
  const p=request.nextUrl.pathname;
  const publicPath=p.startsWith("/login")||p.startsWith("/auth/callback")||p.startsWith("/_next")||p==="/favicon.ico";
  if(!user&&!publicPath){ const u=request.nextUrl.clone(); u.pathname="/login"; return NextResponse.redirect(u); }
  if(user&&p==="/login"){ const u=request.nextUrl.clone(); u.pathname="/today"; return NextResponse.redirect(u); }
  return response;
}
export const config={matcher:["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
