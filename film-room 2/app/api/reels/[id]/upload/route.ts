import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Accepts a finished MP4 as multipart/form-data (field name "file"),
// stores it in the private "reels" Storage bucket, and flips the reel to
// "submitted" so it shows up on /review.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const db = supabaseAdmin();
  const path = `${id}/${Date.now()}-${file.name}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from("reels")
    .upload(path, bytes, { contentType: file.type || "video/mp4", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { error } = await db
    .from("reels")
    .update({
      status: "submitted",
      final_video_url: path,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, path });
}
