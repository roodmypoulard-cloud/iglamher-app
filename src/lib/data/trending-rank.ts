// Pure ranking for "Trending This Week" — no DB, no server-only, unit-testable.
export type TrendingBookingRow = { professional_id: string; created_at: string };

/**
 * Keep bookings inside the rolling window, tally per professional, and return
 * professional ids ordered by count (desc), then most-recent activity as a
 * stable tiebreak.
 */
export function rankByRecentActivity(rows: TrendingBookingRow[], now: number, windowDays: number, limit = 8): string[] {
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  const count = new Map<string, number>();
  const latest = new Map<string, number>();
  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    count.set(r.professional_id, (count.get(r.professional_id) ?? 0) + 1);
    latest.set(r.professional_id, Math.max(latest.get(r.professional_id) ?? 0, t));
  }
  return [...count.keys()]
    .sort((a, b) => (count.get(b)! - count.get(a)!) || (latest.get(b)! - latest.get(a)!))
    .slice(0, limit);
}
