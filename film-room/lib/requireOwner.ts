import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabaseServer";

export async function requireOwner() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("role,active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active || profile.role !== "owner") throw new Error("FORBIDDEN");
  return user;
}
