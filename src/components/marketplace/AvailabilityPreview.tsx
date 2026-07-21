"use client";
import { useMemo, useState } from "react";
import { computeDaySlots, type AvailabilityConfig } from "@/lib/availability/calc";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/format";

interface Props {
  professionalSlug: string;
  config: AvailabilityConfig;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
}

function localDateParts(d: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, weekday: get("weekday"), day: get("day") };
}

export function AvailabilityPreview({ professionalSlug, config, durationMin, bufferBeforeMin, bufferAfterMin }: Props) {
  const now = useMemo(() => new Date(), []);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() + i * 86_400_000);
      const { date, weekday, day } = localDateParts(d, config.timezone);
      const slots = computeDaySlots(config, {
        date,
        serviceDurationMin: durationMin,
        bufferBeforeMin,
        bufferAfterMin,
        slotIntervalMin: 30,
        now,
      });
      return { date, weekday, day, slots };
    });
  }, [now, config, durationMin, bufferBeforeMin, bufferAfterMin]);

  const openSlots = days.find((d) => d.date === openDate)?.slots ?? [];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const has = d.slots.length > 0;
          const active = openDate === d.date;
          return (
            <button
              key={d.date}
              type="button"
              disabled={!has}
              onClick={() => {
                setOpenDate(active ? null : d.date);
                if (!active) track("availability_preview_opened", { professional: professionalSlug, date: d.date });
              }}
              className={cn(
                "flex min-w-[64px] flex-none flex-col items-center gap-0.5 rounded-[12px] border px-3 py-2.5 text-center transition-colors",
                active ? "border-rose bg-rose/10" : "border-border",
                has ? "text-ink hover:border-rose/50" : "text-ink-muted opacity-45",
              )}
            >
              <span className="text-[11px] uppercase tracking-wide">{d.weekday}</span>
              <span className="font-display text-lg font-semibold">{d.day}</span>
              <span className="text-[10px] text-ink-muted">{has ? `${d.slots.length} open` : "—"}</span>
            </button>
          );
        })}
      </div>

      {openDate && (
        <div className="mt-3 flex flex-wrap gap-2">
          {openSlots.length === 0 ? (
            <p className="text-sm text-ink-muted">No openings this day.</p>
          ) : (
            openSlots.slice(0, 16).map((s) => (
              <span
                key={s.startUtc}
                className="rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm text-ink-secondary"
              >
                {s.startLocal}
              </span>
            ))
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-muted">
        Live times shown in the pro&apos;s timezone. Booking opens in the next phase.
      </p>
    </div>
  );
}
