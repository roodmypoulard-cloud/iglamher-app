import "server-only";
// "Trending This Week" — ranks professionals by REAL recent booking activity in a
// rolling window (default 7 days, widened to 14 when the 7-day window is sparse),
// NOT lifetime jobsCompleted. Because this reads across all pros' bookings it uses
// the service-role client server-side and returns ONLY professional_id counts —
// never customer or payment data. If the window is quiet it returns an empty list
// and the UI shows an honest fallback rather than lifetime most-booked.
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { rankByRecentActivity, type TrendingBookingRow } from "@/lib/data/trending-rank";

// Bookings that represent genuine demand (exclude the abandoned pending_payment
// and cancelled/refunded states so a flurry of dropped checkouts can't fake heat).
const COUNTED_STATUSES = ["confirmed", "in_progress", "completed"] as const;

type BookingRow = TrendingBookingRow;

/**
 * Professional ids trending in the last `windowDays` (default 7). Falls back to a
 * 14-day window when fewer than `minPros` pros have activity in 7 days. Returns []
 * in seed mode or when the window is genuinely quiet.
 */
export async function getTrendingProfessionalIds(windowDays = 7, limit = 8, minPros = 3): Promise<string[]> {
  if (!isLiveSupabase()) return [];
  const admin = createAdminClient();
  const now = Date.now();
  // Pull a wide-enough window once (14d) and rank the 7d slice from it; widen only
  // if 7d is too sparse — one query, no double round-trip.
  const since = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("bookings")
    .select("professional_id, created_at")
    .in("status", COUNTED_STATUSES as unknown as string[])
    .gte("created_at", since)
    .limit(5000);
  if (error || !data) return [];
  const rows = data as BookingRow[];

  const primary = rankByRecentActivity(rows, now, windowDays, limit);
  if (primary.length >= minPros) return primary;
  // Sparse week — widen to 14 days rather than silently showing lifetime totals.
  return rankByRecentActivity(rows, now, 14, limit);
}
