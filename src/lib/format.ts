// Formatting helpers. All money stored in integer cents.

export function formatPrice(cents: number, opts?: { from?: boolean }): string {
  const dollars = cents / 100;
  const str =
    dollars % 1 === 0
      ? `$${dollars.toFixed(0)}`
      : `$${dollars.toFixed(2)}`;
  return opts?.from ? `from ${str}` : str;
}

export function formatRating(avg: number): string {
  return avg.toFixed(1);
}

export function formatDistance(mi: number): string {
  return `${mi.toFixed(1)} mi away`;
}

/** Coarse distance bucket for professionals who hide their exact pin.
 *
 *  `formatDistance` reports 0.1-mile precision, which is a circle of radius r
 *  around the viewer. Two or three viewer positions intersect those circles down
 *  to a specific building — so precise distance quietly undoes hiding the pin.
 *  Buckets keep the number useful for choosing a pro while leaving each ring
 *  wide enough that intersecting them doesn't localise anyone. */
const DISTANCE_BUCKETS: { max: number; label: string }[] = [
  { max: 1, label: "Under 1 mi away" },
  { max: 3, label: "1–3 mi away" },
  { max: 5, label: "3–5 mi away" },
  { max: 10, label: "5–10 mi away" },
  { max: 20, label: "10–20 mi away" },
];

export function formatApproxDistance(mi: number): string {
  return DISTANCE_BUCKETS.find((b) => mi < b.max)?.label ?? "20+ mi away";
}

/** Distance label honouring the pro's privacy choice. Use this everywhere a
 *  distance is shown to a customer — never `formatDistance` directly. */
export function formatDistanceFor(mi: number, hideExactPin: boolean): string {
  return hideExactPin ? formatApproxDistance(mi) : formatDistance(mi);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
