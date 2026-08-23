import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Owner adds an editor. Sends a real Supabase Auth invite email so they can
// set a password and log in themselves — this uses Supabase's built-in
// email sending, no separate email service required.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.email || !body.displayName) {
    return NextResponse.json({ error: "email and displayName are required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(body.email);
  if (inviteError) {
    return NextResponse.json({ error: `Invite failed: ${inviteError.message}` }, { status: 500 });
  }

  const { data, error } = await db
    .from("editors")
    .insert({
      auth_user_id: invited.user?.id ?? null,
      display_name: body.displayName,
      email: body.email,
      role: body.role === "owner" ? "owner" : "editor",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ editor: data });
}

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db.from("editors").select("*").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ editors: data });
}
