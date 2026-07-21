import { formatRating } from "@/lib/format";

export function Rating({
  average,
  count,
  showCount = true,
  className = "",
}: {
  average: number;
  count?: number;
  showCount?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 text-rose ${className}`}>
      <span aria-hidden>★</span>
      <span className="font-semibold tabular-nums">{formatRating(average)}</span>
      {showCount && count != null && (
        <span className="text-ink-muted">({count})</span>
      )}
      <span className="sr-only">
        {average.toFixed(1)} out of 5{count != null ? `, ${count} reviews` : ""}
      </span>
    </span>
  );
}
