import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: reel, error: fetchError } = await db
    .from("reels")
    .select("final_video_url")
    .eq("id", id)
    .single();
  if (fetchError || !reel?.final_video_url) {
    return NextResponse.json({ error: "No video on file." }, { status: 404 });
  }
  const { data, error } = await db.storage
    .from("reels")
    .createSignedUrl(reel.final_video_url, 3600);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
