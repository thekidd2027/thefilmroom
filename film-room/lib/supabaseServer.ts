import { createClient } from "@supabase/supabase-js";

// Server-side client, uses the service role key so API routes (generate,
// approve, reject, upload) can write regardless of the caller's session.
// NEVER import this file into a client component — the service role key
// must stay server-only.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
