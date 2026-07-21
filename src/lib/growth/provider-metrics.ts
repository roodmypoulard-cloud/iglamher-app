// ============================================================
// Provider growth tools — pure analytics for a single professional.
// Earnings, repeat customers, booking trends, revenue forecast, utilization,
// and simple service-optimization suggestions. Integer cents; unit-tested.
// ============================================================
import type { BookingFact } from "@/lib/analytics/metrics";

const isPaid = (s: string) => ["confirmed", "in_progress", "completed", "no_show", "disputed", "refunded"].includes(s);
const isCompleted = (s: string) => s === "completed";

export interface ProviderEarnings {
  grossCents: number; // total paid booking value
  platformFeesCents: number;
  netEarningsCents: number; // gross - fees (what the pro keeps, pre-tip nuance)
  completedJobs: number;
  avgTicketCents: number;
}

export function providerEarnings(bookings: BookingFact[]): ProviderEarnings {
  const paid = bookings.filter((b) => isPaid(b.status));
  const grossCents = paid.reduce((s, b) => s + b.totalCents, 0);
  const platformFeesCents = paid.reduce((s, b) => s + b.platformFeeCents, 0);
  const completed = paid.filter((b) => isCompleted(b.status)).length;
  return {
    grossCents,
    platformFeesCents,
    netEarningsCents: grossCents - platformFeesCents,
    completedJobs: completed,
    avgTicketCents: paid.length ? Math.round(grossCents / paid.length) : 0,
  };
}

export function repeatCustomerRate(bookings: BookingFact[]): number {
  const paid = bookings.filter((b) => isPaid(b.status));
  const per = new Map<string, number>();
  for (const b of paid) per.set(b.customerId, (per.get(b.customerId) ?? 0) + 1);
  const repeat = [...per.values()].filter((n) => n > 1).length;
  return per.size ? Math.round((repeat / per.size) * 10000) / 10000 : 0;
}

/** Weekly earnings for the last N ISO weeks (revenue trend). */
export function weeklyEarnings(bookings: BookingFact[], weeks = 8): { weekStart: string; netCents: number }[] {
  const paid = bookings.filter((b) => isPaid(b.status));
  const map = new Map<string, number>();
  for (const b of paid) {
    const d = new Date(b.createdAt);
    const day = d.getUTCDay();
    const monday = new Date(d.getTime() - ((day + 6) % 7) * 86_400_000);
    const key = monday.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + (b.totalCents - b.platformFeeCents));
  }
  return [...map.entries()]
    .map(([weekStart, netCents]) => ({ weekStart, netCents }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-weeks);
}

/** Naive next-period forecast = average of the trailing periods. */
export function forecastNextPeriodCents(series: number[], lookback = 4): number {
  if (series.length === 0) return 0;
  const tail = series.slice(-lookback);
  return Math.round(tail.reduce((a, b) => a + b, 0) / tail.length);
}

/**
 * Utilization = booked hours / available hours over the window.
 * availableHours passed in from the availability layer.
 */
export function utilizationRate(bookedMinutes: number, availableMinutes: number): number {
  if (availableMinutes <= 0) return 0;
  return Math.round(Math.min(1, bookedMinutes / availableMinutes) * 10000) / 10000;
}

export interface OptimizationSuggestion {
  kind: "add_availability" | "adjust_price" | "improve_completion" | "reduce_cancellation";
  message: string;
}

/** Actionable, rule-based suggestions (no ML needed). */
export function optimizationSuggestions(input: {
  utilization: number;
  cancellationRate: number;
  completionRate: number;
  avgTicketCents: number;
  marketAvgTicketCents: number;
}): OptimizationSuggestion[] {
  const out: OptimizationSuggestion[] = [];
  if (input.utilization > 0.85) out.push({ kind: "add_availability", message: "You're nearly fully booked — add more hours to capture demand." });
  if (input.utilization < 0.3) out.push({ kind: "adjust_price", message: "Low utilization — consider a promo or lower starting price to fill your calendar." });
  if (input.cancellationRate > 0.15) out.push({ kind: "reduce_cancellation", message: "Cancellation rate is high — it lowers your search ranking. Tighten your schedule buffers." });
  if (input.completionRate < 0.9) out.push({ kind: "improve_completion", message: "Some confirmed bookings aren't completing — follow up to reduce no-shows." });
  if (input.avgTicketCents < input.marketAvgTicketCents * 0.75) out.push({ kind: "adjust_price", message: "Your average ticket is below market — consider premium add-ons or packages." });
  return out;
}
