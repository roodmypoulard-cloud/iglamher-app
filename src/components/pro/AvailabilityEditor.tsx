"use client";
import { useActionState, useMemo, useState } from "react";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { saveAvailabilityAction, type ActionState } from "@/lib/pro/actions";
import type { AvailabilityRule } from "@/lib/data/model";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Phoenix",
];

// 06:00–22:00 in 30-min steps.
const TIME_OPTS = Array.from({ length: (22 - 6) * 2 + 1 }, (_, i) => {
  const min = 6 * 60 + i * 30;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const label = `${((h + 11) % 12) + 1}:${m === 0 ? "00" : "30"} ${h < 12 ? "AM" : "PM"}`;
  return { min, label };
});

interface DayState {
  enabled: boolean;
  start: number;
  end: number;
}

const inputCls = "rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-rose";

export function AvailabilityEditor({
  initialRules,
  timezone = "America/Los_Angeles",
  minNoticeMinutes = 120,
  maxWindowDays = 60,
}: {
  initialRules: AvailabilityRule[];
  timezone?: string;
  minNoticeMinutes?: number;
  maxWindowDays?: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveAvailabilityAction, undefined);
  const [tz, setTz] = useState(timezone);
  const [notice, setNotice] = useState(minNoticeMinutes);
  const [windowDays, setWindowDays] = useState(maxWindowDays);
  const [days, setDays] = useState<DayState[]>(() =>
    DAYS.map((_, weekday) => {
      const rule = initialRules.find((r) => r.weekday === weekday);
      return rule
        ? { enabled: true, start: rule.startMinute, end: rule.endMinute }
        : { enabled: false, start: 9 * 60, end: 18 * 60 };
    }),
  );

  const payload = useMemo(() => {
    const windows = days
      .map((d, weekday) => ({ weekday, startMinute: d.start, endMinute: d.end, enabled: d.enabled }))
      .filter((w) => w.enabled && w.endMinute > w.startMinute)
      .map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute }));
    return JSON.stringify({ timezone: tz, minNoticeMinutes: notice, maxWindowDays: windowDays, windows });
  }, [days, tz, notice, windowDays]);

  function update(i: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  return (
    <form action={action} className="max-w-2xl space-y-6">
      {state?.error && (
        <p role="alert" className="rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="rounded-[10px] border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">{state.success}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Timezone</span>
          <select value={tz} onChange={(e) => setTz(e.target.value)} className={`${inputCls} w-full`}>
            {TIMEZONES.map((z) => (
              <option key={z} value={z}>
                {z.replace("America/", "").replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Min notice (hrs)</span>
          <input
            type="number"
            min={0}
            value={Math.round(notice / 60)}
            onChange={(e) => setNotice(Number(e.target.value) * 60)}
            className={`${inputCls} w-full`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Booking window (days)</span>
          <input type="number" min={1} max={365} value={windowDays} onChange={(e) => setWindowDays(Number(e.target.value))} className={`${inputCls} w-full`} />
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-ink">Weekly hours</p>
        {days.map((d, i) => (
          <div key={DAYS[i]} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-border bg-surface px-4 py-3">
            <label className="flex w-32 items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={d.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} className="h-4 w-4 accent-[#D7A08F]" />
              {DAYS[i]}
            </label>
            {d.enabled ? (
              <div className="flex items-center gap-2">
                <select value={d.start} onChange={(e) => update(i, { start: Number(e.target.value) })} className={inputCls}>
                  {TIME_OPTS.map((t) => (
                    <option key={t.min} value={t.min}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <span className="text-ink-muted">to</span>
                <select value={d.end} onChange={(e) => update(i, { end: Number(e.target.value) })} className={inputCls}>
                  {TIME_OPTS.map((t) => (
                    <option key={t.min} value={t.min}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-sm text-ink-muted">Closed</span>
            )}
          </div>
        ))}
      </div>

      <input type="hidden" name="payload" value={payload} />
      <SubmitButton className="!w-auto px-8">Save availability</SubmitButton>
    </form>
  );
}
