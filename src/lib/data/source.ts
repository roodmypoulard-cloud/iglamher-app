// Chooses the data source. When a real Supabase project is configured we query
// Postgres (indexed retrieval + RLS). Otherwise we serve the deterministic seed
// so the UI renders locally. The SAME ranking/visibility/availability code runs
// on top of whichever source returns the rows.
import { publicEnv } from "@/lib/env";

export function isLiveSupabase(): boolean {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url) && !url.includes("placeholder");
}
