import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const expectedToken = process.env.OWNER_PASSWORD_SETUP_TOKEN;
    if (!expectedToken) {
      return NextResponse.json(
        { error: "Owner password setup is disabled." },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");

    if (!token || token !== expectedToken) {
      return NextResponse.json({ error: "Invalid setup code." }, { status: 403 });
    }

    if (password.length < 10) {
      return NextResponse.json(
        { error: "Use a password with at least 10 characters." },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const { data: owners, error: ownerError } = await db
      .from("profiles")
      .select("id,role,active")
      .eq("role", "owner")
      .eq("active", true)
      .limit(2);

    if (ownerError) throw ownerError;
    if (!owners?.length) {
      return NextResponse.json({ error: "No active owner account was found." }, { status: 404 });
    }
    if (owners.length !== 1) {
      return NextResponse.json(
        { error: "More than one active owner exists. Disable this setup route and update the password directly in Supabase." },
        { status: 409 }
      );
    }

    const ownerId = owners[0].id;
    const { error: updateError } = await db.auth.admin.updateUserById(ownerId, {
      password,
    });
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      message: "Owner password created. Remove OWNER_PASSWORD_SETUP_TOKEN from Vercel now, then sign in normally.",
    });
  } catch (err: any) {
    console.error("Owner password setup failed", err);
    return NextResponse.json(
      { error: err?.message ?? "Owner password setup failed." },
      { status: 500 }
    );
  }
}
