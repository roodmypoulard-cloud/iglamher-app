import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

// Server Supabase client, bound to the request cookies. Respects RLS
// as the signed-in user. Use in server components / actions / route handlers.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore (middleware refreshes)
          }
        },
      },
    },
  );
}

// Alias used by the Phase 3 data/marketplace/pro modules.
export const createSupabaseServerClient = createClient;
