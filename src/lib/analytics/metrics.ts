// ============================================================
// Platform analytics — pure aggregation functions over raw records.
// Deterministic → unit-tested. The data-access layer feeds these arrays; these
// compute GMV, revenue, DAU/MAU, retention, conversion, funnel, cancellation,
// repeat-rate, provider utilization, and CLV.
// ============================================================

export interface BookingFact {
  id: string;
  customerId: string;
  professionalId: string;
  status: string; // booking_status
  totalCents: number;
  platformFeeCents: number;
  createdAt: string; // UTC ISO
  startsAt: string;
}

export interface EventFact {
  userId: string | null;
  event: string;
  createdAt: string; // UTC ISO
}

const isPaid = (s: string) => ["confirmed", "in_progress", "completed", "no_show", "disputed", "refunded"].includes(s);
const isCompleted = (s: string) => s === "completed";
const isCancelled = (s: string) => s.startsWith("cancelled") || s === "refunded";

const dayKey = (iso: string) => iso.slice(0, 10);
const daysBetween = (a: string, b: string) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

export interface PlatformMetrics {
  gmvCents: number; // gross merchandise value (paid bookings)
  platformRevenueCents: number; // commission captured
  completedBookings: number;
  paidBookings: number;
  cancellationRate: number; // 0..1
  repeatCustomerRate: number; // 0..1
  avgBookingValueCents: number;
  activeCustomers: number;
  activeProfessionals: number;
}

export function platformMetrics(bookings: BookingFact[]): PlatformMetrics {
  const paid = bookings.filter((b) => isPaid(b.status));
  const completed = bookings.filter((b) => isCompleted(b.status));
  const cancelled = bookings.filter((b) => isCancelled(b.status));

  const gmvCents = paid.reduce((s, b) => s + b.totalCents, 0);
  const platformRevenueCents = paid.reduce((s, b) => s + b.platformFeeCents, 0);

  const perCustomer = new Map<string, number>();
  for (const b of paid) perCustomer.set(b.customerId, (perCustomer.get(b.customerId) ?? 0) + 1);
  const repeatCustomers = [...perCustomer.values()].filter((n) => n > 1).length;
  const repeatCustomerRate = perCustomer.size ? repeatCustomers / perCustomer.size : 0;

  const decided = completed.length + cancelled.length;
  const cancellationRate = decided ? cancelled.length / decided : 0;

  return {
    gmvCents,
    platformRevenueCents,
    completedBookings: completed.length,
    paidBookings: paid.length,
    cancellationRate: round4(cancellationRate),
    repeatCustomerRate: round4(repeatCustomerRate),
    avgBookingValueCents: paid.length ? Math.round(gmvCents / paid.length) : 0,
    activeCustomers: perCustomer.size,
    activeProfessionals: new Set(paid.map((b) => b.professionalId)).size,
  };
}

/** Unique active users in the N days ending at `asOf` (DAU=1, MAU=30). */
export function activeUsers(events: EventFact[], asOf: string, windowDays: number): number {
  const cutoff = new Date(new Date(asOf).getTime() - windowDays * 86_400_000).toISOString();
  const users = new Set<string>();
  for (const e of events) if (e.userId && e.createdAt > cutoff && e.createdAt <= asOf) users.add(e.userId);
  return users.size;
}

/**
 * Booking conversion funnel from event counts.
 * search → professional_viewed → booking_started → checkout_started → booking_confirmed.
 */
export function bookingFunnel(events: EventFact[]): { step: string; count: number; conversionFromTop: number }[] {
  const steps = ["search_submitted", "professional_viewed", "booking_started", "checkout_started", "booking_confirmed"];
  const counts = steps.map((s) => events.filter((e) => e.event === s).length);
  const top = counts[0] || 1;
  return steps.map((step, i) => ({ step, count: counts[i], conversionFromTop: round4(counts[i] / top) }));
}

/** Customer lifetime value = total paid spend per customer (avg + top). */
export function lifetimeValue(bookings: BookingFact[]): { avgCents: number; maxCents: number } {
  const paid = bookings.filter((b) => isPaid(b.status));
  const per = new Map<string, number>();
  for (const b of paid) per.set(b.customerId, (per.get(b.customerId) ?? 0) + b.totalCents);
  const vals = [...per.values()];
  if (!vals.length) return { avgCents: 0, maxCents: 0 };
  return { avgCents: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), maxCents: Math.max(...vals) };
}

/**
 * N-day retention: of customers whose first paid booking was in the cohort
 * window, the share who booked again within `retentionDays`.
 */
export function retentionRate(bookings: BookingFact[], retentionDays = 30): number {
  const paid = bookings.filter((b) => isPaid(b.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const firstByCustomer = new Map<string, string>();
  const laterBooking = new Map<string, boolean>();
  for (const b of paid) {
    if (!firstByCustomer.has(b.customerId)) {
      firstByCustomer.set(b.customerId, b.createdAt);
    } else {
      const first = firstByCustomer.get(b.customerId)!;
      if (daysBetween(first, b.createdAt) <= retentionDays) laterBooking.set(b.customerId, true);
    }
  }
  const cohort = firstByCustomer.size;
  return cohort ? round4([...laterBooking.values()].filter(Boolean).length / cohort) : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Group GMV by day for a simple revenue trend line. */
export function dailyGmv(bookings: BookingFact[]): { date: string; gmvCents: number }[] {
  const map = new Map<string, number>();
  for (const b of bookings.filter((x) => isPaid(x.status))) {
    const d = dayKey(b.createdAt);
    map.set(d, (map.get(d) ?? 0) + b.totalCents);
  }
  return [...map.entries()].map(([date, gmvCents]) => ({ date, gmvCents })).sort((a, b) => a.date.localeCompare(b.date));
}
