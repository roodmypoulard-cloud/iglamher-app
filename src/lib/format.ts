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
