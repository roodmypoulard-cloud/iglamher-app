import { redirect } from "next/navigation";
import { ProShell } from "@/components/pro/ProShell";
import { getProContext } from "@/lib/pro/context";
import { getMyProviderGrowth, getPayoutOverview } from "@/lib/growth/data";
import { ConnectPayouts } from "@/components/pro/ConnectPayouts";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings · iGlamHer Pro" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-muted">{sub}</p>}
    </div>
  );
}

export default async function ProEarningsPage() {
  const ctx = await getProContext();
  if (!ctx.authed) redirect("/signin?next=/pro/earnings");

  const [growth, payout] = await Promise.all([
    getMyProviderGrowth(ctx.pro ? (ctx.pro.reliabilityScore < 75 ? 0.2 : 0.05) : 0),
    getPayoutOverview(),
  ]);
  const maxWeek = Math.max(1, ...growth.weekly.map((w) => w.netCents));

  return (
    <ProShell active="/pro/earnings" isDemo={ctx.isDemo}>
      <h1 className="mb-1 font-display text-2xl font-bold">Earnings &amp; growth</h1>
      <p className="mb-6 text-sm text-ink-muted">Your net earnings after the platform fee, trends, and tips to grow.</p>

      <div className="mb-6">
        <ConnectPayouts overview={payout} />
      </div>

      {!growth.available && !ctx.isDemo && (
        <div className="mb-6 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
          No completed bookings yet — your earnings and trends will populate here as you work.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Net earnings" value={formatPrice(growth.earnings.netEarningsCents)} sub="after platform fee" />
        <Stat label="Gross booked" value={formatPrice(growth.earnings.grossCents)} />
        <Stat label="Completed jobs" value={String(growth.earnings.completedJobs)} />
        <Stat label="Avg ticket" value={formatPrice(growth.earnings.avgTicketCents)} />
        <Stat label="Repeat clients" value={`${Math.round(growth.repeatRate * 100)}%`} />
        <Stat label="Platform fees" value={formatPrice(growth.earnings.platformFeesCents)} />
        <Stat label="Next-week forecast" value={formatPrice(growth.forecastNextWeekCents)} sub="trailing avg" />
      </div>

      {growth.weekly.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Weekly net earnings</h2>
          <div className="flex items-end gap-2 rounded-[16px] border border-border bg-surface p-4" style={{ height: 160 }}>
            {growth.weekly.map((w) => (
              <div key={w.weekStart} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div className="w-full rounded-t rose-gradient" style={{ height: `${(w.netCents / maxWeek) * 110}px` }} />
                <span className="text-[9px] text-ink-muted">{w.weekStart.slice(5)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Grow your business</h2>
      {growth.suggestions.length === 0 ? (
        <p className="text-sm text-ink-muted">You&apos;re on track — keep it up.</p>
      ) : (
        <div className="space-y-2">
          {growth.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-[12px] border border-rose/30 bg-rose/[0.06] px-4 py-3">
              <span aria-hidden className="text-rose">✦</span>
              <p className="text-sm text-ink-secondary">{s.message}</p>
            </div>
          ))}
        </div>
      )}
    </ProShell>
  );
}
