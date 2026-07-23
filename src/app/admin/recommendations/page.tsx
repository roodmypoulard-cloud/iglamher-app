import Image from "next/image";
import Link from "next/link";
import { AdminRecommendToggle } from "@/components/admin/AdminRecommendToggle";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getRecommendationRoster } from "@/lib/admin/recommendations-data";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Featured Recommendations · iGlamHer" };

const SUB_BADGE: Record<string, string> = {
  active: "bg-success/15 text-success",
  trialing: "bg-gold/15 text-gold",
  past_due: "bg-warning/15 text-warning",
  canceled: "bg-danger/15 text-danger",
  unpaid: "bg-danger/15 text-danger",
  incomplete: "bg-border/60 text-ink-muted",
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-3.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[10.5px] text-ink-muted">{sub}</p>}
    </div>
  );
}

export default async function AdminRecommendationsPage() {
  await requireAdminPage("/admin/recommendations");
  const { rows, stats } = await getRecommendationRoster();
  const preview = rows.filter((r) => r.isRecommended && r.isActive).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Program explainer — honest copy per spec */}
      <div className="mb-4 rounded-[16px] border border-rose/25 bg-rose/[0.05] px-4 py-3">
        <p className="text-sm font-bold text-ink">Featured Recommendations · $2.99/month</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
          Professionals pay $2.99/month for eligibility to appear more frequently in recommendation
          placements. Payment does not guarantee a specific ranking or number of bookings — placement
          still requires an approved, active account and never overrides trust &amp; safety rules.
        </p>
      </div>

      {/* Honest stats — no invented analytics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Active subscribers" value={stats.active} />
        <Stat label="Trialing" value={stats.trialing} />
        <Stat label="Past due" value={stats.pastDue} />
        <Stat label="Canceled" value={stats.canceled} />
        <Stat label="Free-era placements" value={stats.freeEra} sub="Admin-granted, no charge" />
        <Stat label="Monthly recurring revenue" value={formatPrice(stats.mrrCents)} sub="Active subscriptions × $2.99" />
      </div>
      <p className="mt-2 text-[11px] text-ink-muted">
        Impression, click and conversion tracking for placements isn&apos;t enabled yet — no numbers are shown rather than estimates.
      </p>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_290px]">
        {/* Roster */}
        <section className="min-w-0 rounded-[16px] border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <h2 className="font-display text-base font-bold">Placement roster</h2>
            <span className="text-[11.5px] text-ink-muted">{rows.length} professionals</span>
          </div>
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-display text-base font-bold text-ink">No placements yet</p>
              <p className="mx-auto mt-1 max-w-[40ch] text-[13px] text-ink-muted">
                Tap “Recommend” on a professional (here or in Professionals) to grant a free-era placement,
                or wait for the first paid subscribers.
              </p>
              <Link href="/admin/professionals" className="mt-4 inline-flex min-h-[42px] items-center rounded-full rose-gradient px-5 text-[13px] font-bold text-[#2A1712]">
                Open Professionals
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-border/60 text-[10.5px] font-bold uppercase tracking-wide text-ink-muted">
                    <th className="px-4 py-2.5">Professional</th>
                    <th className="px-3 py-2.5">Subscription</th>
                    <th className="px-3 py-2.5">Renews / ends</th>
                    <th className="px-3 py-2.5">Amount</th>
                    <th className="px-3 py-2.5">Featured</th>
                    <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.map((r) => (
                    <tr key={r.userId} className="text-[12.5px]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {r.avatarUrl ? (
                            <Image src={r.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-[8px] object-cover" />
                          ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-rose/12 text-[12px] font-bold text-rose" aria-hidden>
                              {r.name.slice(0, 1)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-bold text-ink">{r.name}</p>
                            <p className="truncate text-[11px] text-ink-muted">{r.specialty} · {r.city}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${r.subStatus ? SUB_BADGE[r.subStatus] ?? "bg-border/60 text-ink-muted" : "bg-rose/12 text-rose"}`}>
                          {r.subStatus ? r.subStatus.replace("_", " ") : "Free era"}
                        </span>
                        {r.cancelAtPeriodEnd && <p className="mt-0.5 text-[10px] text-warning">Cancels at period end</p>}
                        {r.lastPaymentStatus === "failed" && <p className="mt-0.5 text-[10px] text-danger">Last payment failed</p>}
                      </td>
                      <td className="px-3 py-3 text-ink-secondary">
                        {r.periodEnd
                          ? new Date(r.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : r.recommendedUntil
                            ? new Date(r.recommendedUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                      </td>
                      <td className="px-3 py-3 text-ink-secondary">{r.subStatus ? "$2.99/mo" : "$0"}</td>
                      <td className="px-3 py-3">
                        <AdminRecommendToggle userId={r.userId} initialRecommended={r.isRecommended} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/admin/applications/${r.userId}`} className="text-[12px] font-semibold text-rose hover:underline">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* App preview — real data */}
        <aside className="rounded-[16px] border border-border bg-surface p-4">
          <h2 className="font-display text-base font-bold">App preview</h2>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">How customers see featured pros on Find Your Glam.</p>
          <div className="mt-3 space-y-2">
            {preview.length === 0 ? (
              <p className="rounded-[12px] border border-border bg-bg px-3 py-6 text-center text-[12px] text-ink-muted">
                No active placements to preview.
              </p>
            ) : (
              preview.map((r) => (
                <div key={r.userId} className="flex items-center gap-2.5 rounded-[14px] border border-rose/20 bg-bg p-2.5">
                  {r.avatarUrl ? (
                    <Image src={r.avatarUrl} alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-[10px] object-cover" />
                  ) : (
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-rose/12 text-[13px] font-bold text-rose" aria-hidden>{r.name.slice(0, 1)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-bold text-ink">{r.name}</p>
                    <p className="truncate text-[10.5px] text-ink-muted">{r.specialty} · {r.city}</p>
                  </div>
                  <span className="flex-none rounded-[5px] bg-bg-elevated px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.1em] text-rose-light">
                    Featured
                  </span>
                </div>
              ))
            )}
          </div>
          <Link href="/recommended" className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-rose/50 text-[12.5px] font-semibold text-rose hover:bg-rose/10">
            View in app →
          </Link>
        </aside>
      </div>
    </div>
  );
}
