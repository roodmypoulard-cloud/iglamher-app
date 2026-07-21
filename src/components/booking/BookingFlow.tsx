"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { ServiceRow, AddonRow } from "@/lib/data/model";
import { computeDaySlots, type AvailabilityConfig, type Slot } from "@/lib/availability/calc";
import { computeBooking } from "@/lib/booking/pricing";
import { createBookingDraftAction } from "@/lib/booking/actions";
import { createCheckoutSessionAction } from "@/lib/payments/actions";
import { formatPrice, formatDuration, cn } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { track } from "@/lib/analytics";

type Step = "service" | "time" | "review" | "done";

interface Props {
  professionalId: string;
  professionalName: string;
  services: ServiceRow[];
  addons: AddonRow[];
  config: AvailabilityConfig;
}

function localDate(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, weekday: g("weekday"), day: g("day") };
}

export function BookingFlow({ professionalId, professionalName, services, addons, config }: Props) {
  const now = useMemo(() => new Date(), []);
  const [step, setStep] = useState<Step>(services.length === 1 ? "time" : "service");
  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ demo: boolean; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;

  const days = useMemo(() => {
    if (!service) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now.getTime() + i * 86_400_000);
      const { date, weekday, day } = localDate(d, config.timezone);
      const slots = computeDaySlots(config, {
        date,
        serviceDurationMin: service.durationMin,
        bufferBeforeMin: service.bufferBeforeMin,
        bufferAfterMin: service.bufferAfterMin,
        slotIntervalMin: 30,
        now,
      });
      return { date, weekday, day, slots };
    });
  }, [service, config, now]);

  const breakdown = useMemo(() => {
    if (!service) return null;
    const selAddons = addons.filter((a) => addonIds.includes(a.id));
    return computeBooking({
      serviceCents: service.priceCents,
      addonsCents: selAddons.reduce((s, a) => s + a.priceCents, 0),
      travelFeeCents: service.locationType === "mobile" ? service.travelFeeCents ?? 0 : 0,
      takeRateBps: 1500,
      deposit: { type: service.depositType, value: service.depositValue ?? undefined },
    });
  }, [service, addons, addonIds]);

  function confirm() {
    if (!service || !slot) return;
    setError(null);
    track("checkout_started", { professional: professionalName });
    start(async () => {
      const res = await createBookingDraftAction({
        professionalId,
        serviceId: service.id,
        startUtc: slot.startUtc,
        endUtc: slot.endUtc,
        addonIds,
      });
      if (!res.ok) {
        if (/sign in/i.test(res.error)) {
          window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        setError(res.error);
        return;
      }
      // Seed/demo mode: no live payment — show the demo confirmation.
      if (res.demo) {
        setResult({ demo: true, id: res.bookingId });
        setStep("done");
        return;
      }
      // Live: hand off to Stripe Checkout to collect payment.
      const checkout = await createCheckoutSessionAction(res.bookingId);
      if (!checkout.ok) {
        if (checkout.needsAuth) {
          window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
        setError(checkout.error);
        return;
      }
      window.location.href = checkout.url;
    });
  }

  const openSlots = days.find((d) => d.date === openDate)?.slots ?? [];

  return (
    <div className="mx-auto max-w-lg">
      <Stepper step={step} />

      {step === "service" && (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Choose a service</h2>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setServiceId(s.id);
                setStep("time");
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[14px] border p-4 text-left transition-colors",
                serviceId === s.id ? "border-rose bg-rose/[0.06]" : "border-border hover:border-rose/50",
              )}
            >
              <span>
                <span className="block font-display text-base font-semibold">{s.name}</span>
                <span className="text-[12px] text-ink-muted">{formatDuration(s.durationMin)}</span>
              </span>
              <span className="font-semibold">{formatPrice(s.priceCents, { from: s.priceIsFrom })}</span>
            </button>
          ))}
        </div>
      )}

      {step === "time" && service && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Pick a time</h2>
          {addons.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Add-ons</p>
              <div className="flex flex-wrap gap-2">
                {addons.map((a) => {
                  const on = addonIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAddonIds((p) => (on ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                      className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-rose bg-rose/10 text-rose" : "border-border text-ink-secondary")}
                    >
                      {a.name} +{formatPrice(a.priceCents)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((d) => {
              const has = d.slots.length > 0;
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={!has}
                  aria-label={`Day ${d.date}`}
                  onClick={() => setOpenDate(d.date)}
                  className={cn(
                    "flex min-w-[60px] flex-none flex-col items-center gap-0.5 rounded-[12px] border px-3 py-2.5",
                    openDate === d.date ? "border-rose bg-rose/10" : "border-border",
                    has ? "text-ink" : "text-ink-muted opacity-40",
                  )}
                >
                  <span className="text-[11px] uppercase">{d.weekday}</span>
                  <span className="font-display text-lg font-semibold">{d.day}</span>
                </button>
              );
            })}
          </div>
          {openDate && (
            <div className="flex flex-wrap gap-2">
              {openSlots.length === 0 ? (
                <p className="text-sm text-ink-muted">No openings this day.</p>
              ) : (
                openSlots.slice(0, 20).map((s) => (
                  <button
                    key={s.startUtc}
                    type="button"
                    onClick={() => {
                      setSlot(s);
                      setStep("review");
                    }}
                    className="rounded-[10px] border border-border bg-surface px-3 py-1.5 text-sm hover:border-rose"
                  >
                    {s.startLocal}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {step === "review" && service && slot && breakdown && (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Review &amp; confirm</h2>
          <div className="card-luxe p-4">
            <p className="font-display text-lg font-semibold">{service.name}</p>
            <p className="text-sm text-ink-muted">
              with {professionalName} · {slot.startLocal}
            </p>
            <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3 text-sm">
              {breakdown.lineItems.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-ink-secondary">{l.label}</span>
                  <span>{l.amountCents < 0 ? `-${formatPrice(-l.amountCents)}` : formatPrice(l.amountCents)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border/60 pt-2 font-semibold">
                <span>Total</span>
                <span>{formatPrice(breakdown.totalCents)}</span>
              </div>
              <div className="flex justify-between text-[12px] text-ink-muted">
                <span>Due now (deposit)</span>
                <span>{formatPrice(breakdown.amountDueNowCents)}</span>
              </div>
            </div>
          </div>
          {error && <p className="rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
          <Button full onClick={confirm} disabled={pending}>
            {pending ? <Spinner size={18} /> : `Confirm — pay ${formatPrice(breakdown.amountDueNowCents)}`}
          </Button>
          <p className="text-center text-[11px] text-ink-muted">
            Secure payment via Stripe. Messaging &amp; calling unlock after your booking is paid.
          </p>
        </div>
      )}

      {step === "done" && result && breakdown && (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full rose-gradient text-3xl text-[#2A1712]">✓</div>
          <h2 className="font-display text-2xl font-bold">Booking {result.demo ? "created" : "confirmed"}</h2>
          <p className="text-sm text-ink-secondary">
            {result.demo
              ? "Demo mode — no payment was taken. With Stripe connected, this is where checkout completes and your booking is confirmed."
              : "You'll receive a confirmation and your stylist has been notified."}
          </p>
          <div className="card-luxe p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Booking ref</span>
              <span className="font-mono text-[12px]">{result.id.slice(0, 18)}…</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-ink-muted">Total</span>
              <span className="font-semibold">{formatPrice(breakdown.totalCents)}</span>
            </div>
          </div>
          <Link href="/account" className="inline-block text-sm font-semibold text-rose hover:underline">
            View my bookings →
          </Link>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ["service", "time", "review", "done"];
  const idx = steps.indexOf(step);
  return (
    <div className="mb-6 flex gap-1.5">
      {steps.map((s, i) => (
        <span key={s} className={cn("h-1 flex-1 rounded-full", i <= idx ? "rose-gradient" : "bg-surface")} />
      ))}
    </div>
  );
}
