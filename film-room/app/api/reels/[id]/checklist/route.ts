import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Toggle a single checklist item for a reel.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: reel, error: fetchError } = await db
    .from("reels")
    .select("checklist")
    .eq("id", id)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const checklist = (reel.checklist ?? []).map((item: any) =>
    item.key === body.key ? { ...item, done: !item.done } : item
  );

  const { error } = await db
    .from("reels")
    .update({ checklist, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, checklist });
}
