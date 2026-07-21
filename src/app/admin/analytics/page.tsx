import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getPlatformAnalytics } from "@/lib/analytics/data";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics · Admin" };

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const { isDemo } = await requireAdminPage("/admin/analytics");
  const a = await getPlatformAnalytics();
  const maxGmv = Math.max(1, ...a.dailyGmv.map((d) => d.gmvCents));

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px] px-5 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">Marketplace performance in real time.</p>
        </div>
        <Link href="/admin" className="text-sm text-rose hover:underline">← Command center</Link>
      </div>
      {isDemo && (
        <div className="mb-6 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
          Preview mode — metrics compute from your live database once connected and admin-authenticated.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KPI label="GMV" value={formatPrice(a.metrics.gmvCents)} />
        <KPI label="Platform revenue" value={formatPrice(a.metrics.platformRevenueCents)} />
        <KPI label="Paid bookings" value={String(a.metrics.paidBookings)} />
        <KPI label="Completed" value={String(a.metrics.completedBookings)} />
        <KPI label="Avg booking" value={formatPrice(a.metrics.avgBookingValueCents)} />
        <KPI label="Cancellation rate" value={`${Math.round(a.metrics.cancellationRate * 100)}%`} />
        <KPI label="Repeat customers" value={`${Math.round(a.metrics.repeatCustomerRate * 100)}%`} />
        <KPI label="30-day retention" value={`${Math.round(a.retention30 * 100)}%`} />
        <KPI label="DAU" value={String(a.dau)} />
        <KPI label="MAU" value={String(a.mau)} />
        <KPI label="Avg CLV" value={formatPrice(a.clv.avgCents)} />
        <KPI label="Active pros" value={String(a.metrics.activeProfessionals)} />
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Booking funnel</h2>
      <div className="space-y-2">
        {a.funnel.map((f) => (
          <div key={f.step} className="flex items-center gap-3">
            <span className="w-40 text-[12px] capitalize text-ink-muted">{f.step.replace(/_/g, " ")}</span>
            <span className="h-6 flex-1 overflow-hidden rounded-full bg-surface">
              <span className="flex h-full items-center rounded-full rose-gradient px-2 text-[10px] font-bold text-[#2A1712]" style={{ width: `${Math.max(6, f.conversionFromTop * 100)}%` }}>
                {f.count}
              </span>
            </span>
            <span className="w-12 text-right text-[12px] tabular-nums text-ink-muted">{Math.round(f.conversionFromTop * 100)}%</span>
          </div>
        ))}
      </div>

      {a.dailyGmv.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Daily GMV</h2>
          <div className="flex items-end gap-1 rounded-[16px] border border-border bg-surface p-4" style={{ height: 140 }}>
            {a.dailyGmv.slice(-30).map((d) => (
              <div key={d.date} className="flex-1 rounded-t rose-gradient" style={{ height: `${(d.gmvCents / maxGmv) * 100}px` }} title={`${d.date}: ${formatPrice(d.gmvCents)}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
