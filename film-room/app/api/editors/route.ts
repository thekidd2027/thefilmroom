import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { requireOwner } from "@/lib/requireOwner";

export async function POST(req: NextRequest) {
  try {
    await requireOwner();
    const body = await req.json().catch(() => ({}));
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "firstName, lastName and email are required" }, { status: 400 });
    }

    const db = supabaseAdmin();
    const redirectTo = `${req.nextUrl.origin}/auth/callback?next=/set-password`;
    const { data: invited, error: inviteError } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { first_name: firstName, last_name: lastName, display_name: `${firstName} ${lastName}` },
    });
    if (inviteError) {
      return NextResponse.json({ error: `Invite failed: ${inviteError.message}` }, { status: 500 });
    }

    const { data, error } = await db
      .from("editors")
      .insert({
        auth_user_id: invited.user?.id ?? null,
        display_name: `${firstName} ${lastName}`,
        email,
        role: "editor",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ editor: data });
  } catch (err: any) {
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : status === 403 ? "Owner access required." : err?.message ?? "Invite failed" }, { status });
  }
}

export async function GET() {
  try {
    await requireOwner();
    const db = supabaseAdmin();
    const { data, error } = await db.from("editors").select("*").order("created_at");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ editors: data });
  } catch (err: any) {
    const status = err?.message === "UNAUTHORIZED" ? 401 : err?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : status === 403 ? "Owner access required." : err?.message ?? "Unable to load editors" }, { status });
  }
}
