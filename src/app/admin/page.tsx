import Link from "next/link";
import { getPlatformOverview, getVerificationQueue, getOpenReports, getOpenDisputes, type QueueItem } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getApplicationCounts, listPendingCustomerIds } from "@/lib/admin/verification-data";
import { getRecommendationRoster } from "@/lib/admin/recommendations-data";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · iGlamHer" };

const SECTIONS = [
  { href: "/admin/applications", label: "Verifications", desc: "Approve new pros" },
  { href: "/admin/analytics", label: "Analytics", desc: "GMV, funnel, retention" },
  { href: "/admin/campaigns", label: "Campaigns", desc: "Promos & coupons" },
];

function SummaryCard({ href, label, value, tone, sub }: { href: string; label: string; value: string | number; tone: "good" | "pending" | "bad"; sub?: string }) {
  const toneCls = tone === "good" ? "text-success" : tone === "pending" ? "text-gold" : "text-danger";
  return (
    <Link href={href} className="rounded-[14px] border border-border bg-surface p-3.5 transition-colors hover:border-rose/50">
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-muted">{sub}</p>}
    </Link>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: "warn" }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${tone === "warn" ? "text-warning" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function Queue({ title, items, empty }: { title: string; items: QueueItem[]; empty: string }) {
  return (
    <section className="rounded-[16px] border border-border bg-surface p-5">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between rounded-[10px] border border-border bg-bg-elevated px-3 py-2 text-sm">
              <span>{i.label}</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-rose">{i.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function AdminPage() {
  const { isDemo } = await requireAdminPage("/admin");

  const [overview, verifQueue, reports, disputes, appCounts, idChecks, rec] = await Promise.all([
    getPlatformOverview(),
    getVerificationQueue(),
    getOpenReports(),
    getOpenDisputes(),
    getApplicationCounts(),
    listPendingCustomerIds(),
    getRecommendationRoster(),
  ]);
  const activePlacements = rec.stats.active + rec.stats.trialing + rec.stats.freeEra;

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      {isDemo && (
        <div className="mt-4 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
          Preview mode — queues and destructive actions require a connected Supabase project and an admin session.
          Overview metrics below are computed from the seed roster.
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <SummaryCard href="/admin/applications?tab=awaiting" label="Pending applications" value={appCounts.awaiting} tone="pending" />
        <SummaryCard href="/admin/applications?tab=approved" label="Approved pros" value={appCounts.approved} tone="good" />
        <SummaryCard href="/admin/applications?tab=changes" label="Changes requested" value={appCounts.changes} tone="pending" />
        <SummaryCard href="/admin/applications?tab=rejected" label="Rejected" value={appCounts.rejected} tone="bad" />
        <SummaryCard href="/admin/verifications" label="Customer ID checks" value={idChecks.length} tone="pending" />
        <SummaryCard href="/admin/recommendations" label="Active placements" value={activePlacements} tone="good" />
        <SummaryCard href="/admin/recommendations" label="Recommendation revenue" value={formatPrice(rec.stats.mrrCents)} tone="good" sub="MRR" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Professionals" value={overview.totalProfessionals} />
        <Metric label="Active" value={overview.activeProfessionals} />
        <Metric label="Verified" value={overview.verifiedProfessionals} />
        <Metric label="Featured" value={overview.featuredProfessionals} />
        <Metric label="Avg rating" value={overview.avgRating.toFixed(2)} />
        <Metric label="Avg reliability" value={overview.avgReliability.toFixed(0)} />
        <Metric label="At-risk" value={overview.atRiskProfessionals} tone={overview.atRiskProfessionals > 0 ? "warn" : undefined} />
        <Metric label="Fraud flags" value={overview.fraudFlags} tone={overview.fraudFlags > 0 ? "warn" : undefined} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-[14px] border border-border bg-surface p-4 transition-colors hover:border-rose/50">
            <p className="font-display text-base font-semibold text-rose">{s.label}</p>
            <p className="mt-0.5 text-[12px] text-ink-muted">{s.desc}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Queue title="Verification queue" items={verifQueue} empty="No pending verifications." />
        <Queue title="Moderation reports" items={reports} empty="No open reports." />
        <Queue title="Open disputes" items={disputes} empty="No open disputes." />
      </div>


    </div>
  );
}
