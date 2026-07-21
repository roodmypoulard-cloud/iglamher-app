import type { ReviewRow } from "@/lib/data/model";
import { formatRating } from "@/lib/format";

export function RatingBreakdown({
  reviews,
  average,
  total,
}: {
  reviews: ReviewRow[];
  average: number;
  total: number;
}) {
  // Distribution from the reviews we have (mock data has a small sample).
  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: reviews.filter((r) => Math.round(r.rating) === star).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.n));

  return (
    <div className="card-luxe flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex flex-col items-center justify-center px-4 text-center sm:border-r sm:border-border">
        <span className="font-display text-4xl font-bold text-ink">{formatRating(average)}</span>
        <span className="mt-1 text-rose" aria-hidden>
          {"★".repeat(Math.round(average))}
          <span className="text-ink-muted">{"★".repeat(5 - Math.round(average))}</span>
        </span>
        <span className="mt-1 text-[11px] text-ink-muted">{total} reviews</span>
      </div>
      <div className="flex-1 space-y-1.5">
        {counts.map((c) => (
          <div key={c.star} className="flex items-center gap-2 text-[11px] text-ink-muted">
            <span className="w-3 tabular-nums">{c.star}</span>
            <span aria-hidden className="text-rose">★</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
              <span className="block h-full rounded-full rose-gradient" style={{ width: `${(c.n / max) * 100}%` }} />
            </span>
            <span className="w-4 text-right tabular-nums">{c.n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
