import "server-only";
// "Next: Today 4:00 PM" pill for recommendation cards, computed from the pro's
// REAL weekly availability rules via the shared slot engine. Card views don't
// carry exceptions or existing bookings, so this is the pro's schedule opening,
// not a guaranteed free slot — the booking flow remains the source of truth
// (it enforces bookings/exceptions/notice before anything is reservable).
import { computeDaySlots, formatLocalTime } from "@/lib/availability/calc";
import type { ProfessionalCardView } from "@/lib/data/model";

const LOOKAHEAD_DAYS = 8;
const DEFAULT_DURATION_MIN = 60;
const MIN_NOTICE_MIN = 60;

function dateInZone(base: Date, timeZone: string, addDays: number): string {
  const d = new Date(base.getTime() + addDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA gives YYYY-MM-DD
}

/** Human label for the first schedule opening in the next week, or null. */
export function nextOpeningLabel(pro: ProfessionalCardView, now = new Date()): string | null {
  const rules = pro.availability ?? [];
  if (rules.length === 0) return null;

  const duration =
    pro.services
      .filter((s) => s.isActive)
      .reduce<number | null>((min, s) => (min == null || s.durationMin < min ? s.durationMin : min), null) ??
    DEFAULT_DURATION_MIN;

  for (let add = 0; add < LOOKAHEAD_DAYS; add++) {
    const date = dateInZone(now, pro.timezone, add);
    const slots = computeDaySlots(
      { timezone: pro.timezone, rules, exceptions: [], minNoticeMinutes: MIN_NOTICE_MIN, maxWindowDays: LOOKAHEAD_DAYS },
      { date, serviceDurationMin: duration, bufferBeforeMin: 0, bufferAfterMin: 0, now },
    );
    const first = slots[0];
    if (!first) continue;

    const time = formatLocalTime(new Date(first.startUtc), pro.timezone);
    if (add === 0) return `Today ${time}`;
    if (add === 1) return `Tomorrow ${time}`;
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: pro.timezone, weekday: "short" }).format(new Date(first.startUtc));
    return `${weekday} ${time}`;
  }
  return null;
}
