import { formatRating } from "@/lib/format";

export function Rating({
  average,
  count,
  showCount = true,
  className = "",
}: {
  average: number | null | undefined;
  count?: number | null;
  showCount?: boolean;
  className?: string;
}) {
  // New pros (no reviews yet) show a "New" badge instead of a misleading ★0.0(0).
  if (count === 0) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-rose/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose ${className}`}
      >
        New
      </span>
    );
  }

  // Null-safe: coerce and fall back to 0 so a missing rating never renders "NaN".
  const avg = Number(average);
  const safeAvg = Number.isFinite(avg) ? avg : 0;

  return (
    <span className={`inline-flex items-center gap-1 text-rose ${className}`}>
      {/* Visible stars are decorative — the accessible string below is the source of truth */}
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        <span>★</span>
        <span className="font-semibold tabular-nums">{formatRating(safeAvg)}</span>
        {showCount && count != null && <span className="text-ink-muted">({count})</span>}
      </span>
      <span className="sr-only">
        {safeAvg.toFixed(1)} out of 5{count != null ? `, ${count} reviews` : ""}
      </span>
    </span>
  );
}
