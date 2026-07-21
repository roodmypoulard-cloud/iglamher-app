import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";

// SERVICE-ROLE client — bypasses RLS. Server-only (import "server-only" throws
// if this ever reaches a client bundle). Use for admin ops, webhooks, seeding.
export function createAdminClient() {
  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
