// ============================================================
// Availability calculation — reusable layer (Phase 3 preview + Phase 4 booking).
//
// Invariants:
//   • All stored/returned instants are UTC.
//   • Working hours are wall-clock minutes in the professional's IANA timezone.
//   • DST is handled by computing the zone offset AT the specific instant
//     (via Intl), so "9:00 local" is correct on both sides of a DST change.
//   • Buffers extend the occupied range; the service itself must fit the window.
//   • Inactive services never reach this layer (caller filters).
//
// No slot locking happens here — that is Phase 4. This only *computes* openings.
// ============================================================
import type { AvailabilityRule, AvailabilityException } from "@/lib/data/model";

export interface AvailabilityConfig {
  timezone: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  minNoticeMinutes: number;
  maxWindowDays: number;
}

export interface SlotRequest {
  /** Local calendar date in the pro's timezone, "YYYY-MM-DD". */
  date: string;
  serviceDurationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  slotIntervalMin?: number;
  now: Date;
  existingBookings?: Array<{ startsAt: string; endsAt: string }>;
}

export interface Slot {
  startUtc: string;
  endUtc: string;
  /** "HH:MM" in the pro's timezone, for display. */
  startLocal: string;
}

interface Interval {
  start: number; // epoch ms
  end: number;
}

const MIN = 60_000;

/** Offset (ms) to add to a UTC instant to get wall-clock time in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - instant.getTime();
}

/** Convert a wall-clock time in `timeZone` to a UTC Date (DST-correct). */
export function zonedTimeToUtc(
  year: number,
  month1: number, // 1..12
  day: number,
  minutesFromMidnight: number,
  timeZone: string,
): Date {
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  // First guess: treat the wall time as if it were UTC.
  const guess = Date.UTC(year, month1 - 1, day, hour, minute, 0);
  // Correct by the offset at that instant, then refine once for DST edges.
  let offset = zoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - offset;
  const offset2 = zoneOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    utc = guess - offset;
  }
  return new Date(utc);
}

/** Weekday (0=Sun..6=Sat) of a wall date in a timezone. */
export function weekdayInZone(year: number, month1: number, day: number, timeZone: string): number {
  const noonUtc = zonedTimeToUtc(year, month1, day, 12 * 60, timeZone);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(noonUtc);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

/** "HH:MM" wall-clock label for a UTC instant in a timezone. */
export function formatLocalTime(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

function subtractIntervals(base: Interval[], cut: Interval[]): Interval[] {
  let result = base;
  for (const c of cut) {
    const next: Interval[] = [];
    for (const b of result) {
      if (c.end <= b.start || c.start >= b.end) {
        next.push(b);
        continue;
      }
      if (c.start > b.start) next.push({ start: b.start, end: Math.min(c.start, b.end) });
      if (c.end < b.end) next.push({ start: Math.max(c.end, b.start), end: b.end });
    }
    result = next;
  }
  return result.filter((i) => i.end > i.start);
}

/**
 * Bookable slot start-times for one local date, honoring rules, exceptions,
 * buffers, existing bookings, minimum notice and the max booking window.
 */
export function computeDaySlots(config: AvailabilityConfig, req: SlotRequest): Slot[] {
  const [y, m, d] = req.date.split("-").map(Number);
  if (!y || !m || !d) return [];

  // Max booking window: reject dates beyond now + maxWindowDays.
  const dayStartUtc = zonedTimeToUtc(y, m, d, 0, config.timezone).getTime();
  const windowEnd = req.now.getTime() + config.maxWindowDays * 24 * 60 * MIN;
  if (dayStartUtc > windowEnd) return [];

  const weekday = weekdayInZone(y, m, d, config.timezone);
  const interval = req.slotIntervalMin ?? 15;
  const totalMin = req.bufferBeforeMin + req.serviceDurationMin + req.bufferAfterMin;

  // 1) Working windows from weekly rules (as UTC intervals).
  let windows: Interval[] = config.rules
    .filter((r) => r.weekday === weekday)
    .map((r) => ({
      start: zonedTimeToUtc(y, m, d, r.startMinute, config.timezone).getTime(),
      end: zonedTimeToUtc(y, m, d, r.endMinute, config.timezone).getTime(),
    }));

  // 2) Add extra-hours exceptions that overlap this day.
  const dayEndUtc = dayStartUtc + 24 * 60 * MIN;
  for (const ex of config.exceptions) {
    if (!ex.isAvailable) continue;
    const s = new Date(ex.startsAt).getTime();
    const e = new Date(ex.endsAt).getTime();
    if (e > dayStartUtc && s < dayEndUtc) windows.push({ start: Math.max(s, dayStartUtc), end: Math.min(e, dayEndUtc) });
  }
  if (windows.length === 0) return [];

  // 3) Subtract blocked exceptions and existing bookings.
  const blocks: Interval[] = [];
  for (const ex of config.exceptions) {
    if (ex.isAvailable) continue;
    blocks.push({ start: new Date(ex.startsAt).getTime(), end: new Date(ex.endsAt).getTime() });
  }
  for (const b of req.existingBookings ?? []) {
    blocks.push({ start: new Date(b.startsAt).getTime(), end: new Date(b.endsAt).getTime() });
  }
  windows = subtractIntervals(windows, blocks).sort((a, b) => a.start - b.start);

  // 4) Step through each window producing service start times.
  const earliest = req.now.getTime() + config.minNoticeMinutes * MIN;
  const slots: Slot[] = [];
  for (const w of windows) {
    // Align first candidate to the interval grid from window start.
    for (let t = w.start; t + req.serviceDurationMin * MIN <= w.end; t += interval * MIN) {
      const occStart = t - req.bufferBeforeMin * MIN;
      const occEnd = t + (req.serviceDurationMin + req.bufferAfterMin) * MIN;
      // Occupied range (incl. buffers) must sit inside this contiguous window.
      if (occStart < w.start || occEnd > w.end) {
        if (totalMin > 0 && occEnd > w.end) break;
        continue;
      }
      if (t < earliest) continue;
      const start = new Date(t);
      slots.push({
        startUtc: start.toISOString(),
        endUtc: new Date(t + req.serviceDurationMin * MIN).toISOString(),
        startLocal: formatLocalTime(start, config.timezone),
      });
    }
  }
  return slots;
}

/** Cheap "does this pro have any weekly hours?" check for the profile preview. */
export function hasWeeklyAvailability(config: Pick<AvailabilityConfig, "rules">): boolean {
  return config.rules.length > 0;
}
