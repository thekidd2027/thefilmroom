import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// An editor self-claims an approved, unassigned reel.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.editorId) {
    return NextResponse.json({ error: "editorId is required" }, { status: 400 });
  }
  const db = supabaseAdmin();

  const { data: existing, error: fetchError } = await db
    .from("reels")
    .select("assigned_to, status")
    .eq("id", id)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (existing.assigned_to) {
    return NextResponse.json({ error: "This reel is already claimed." }, { status: 409 });
  }

  const { error } = await db
    .from("reels")
    .update({
      status: "claimed",
      assigned_to: body.editorId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
