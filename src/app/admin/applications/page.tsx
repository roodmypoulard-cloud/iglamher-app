import Link from "next/link";
import Image from "next/image";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import {
  getApplicationCounts,
  getApplicationsByTab,
  getApplicationDetail,
  listPendingCustomerIds,
  type AppTab,
} from "@/lib/admin/verification-data";
import { getRecommendationRoster } from "@/lib/admin/recommendations-data";
import { CustomerIdReviewRow } from "@/components/admin/CustomerIdReviewRow";
import { ApplicationQueueRow } from "@/components/admin/ApplicationQueueRow";
import { VerificationReviewActions } from "@/components/admin/VerificationReviewActions";
import { PortfolioGallery, DocumentViewer } from "@/components/admin/ApplicationMedia";
import { AdminRecommendToggle } from "@/components/admin/AdminRecommendToggle";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Applications & Recommendations · iGlamHer" };

const TABS: { key: AppTab; label: string }[] = [
  { key: "awaiting", label: "Awaiting review" },
  { key: "changes", label: "Changes requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const EMPTY: Record<AppTab, string> = {
  awaiting: "No applications awaiting review 🎉",
  changes: "Nobody has an open change request.",
  approved: "No approved pros yet.",
  rejected: "No rejected applications.",
};

type SVG = { className?: string };
const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const StatIcons = {
  pending: (p: SVG) => <svg viewBox="0 0 24 24" width={16} height={16} {...s} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2" /></svg>,
  approved: (p: SVG) => <svg viewBox="0 0 24 24" width={16} height={16} {...s} className={p.className}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.2 2.2L15.5 9.5" /></svg>,
  changes: (p: SVG) => <svg viewBox="0 0 24 24" width={16} height={16} {...s} className={p.className}><path d="M4 6h16M4 12h10M4 18h13" /></svg>,
  rejected: (p: SVG) => <svg viewBox="0 0 24 24" width={16} height={16} {...s} className={p.className}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></svg>,
  id: (p: SVG) => <svg viewBox="0 0 24 24" width={16} height={16} {...s} className={p.className}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="12" r="2" /><path d="M13 10h5M13 14h5" /></svg>,
  featured: (p: SVG) => <svg viewBox="0 0 24 24" width={16} height={16} {...s} className={p.className}><path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.8 6.4 20l1.3-6.2L3 9.5l6.3-.7L12 3Z" /></svg>,
  revenue: (p: SVG) => <svg viewBox="0 0 24 24" width={16} height={16} {...s} className={p.className}><circle cx="12" cy="12" r="9" /><path d="M14.5 9.3A2.7 2.7 0 0 0 12 8c-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.9 2.5 2-1 2-2.5 2a2.7 2.7 0 0 1-2.5-1.3M12 6.5v11" /></svg>,
};

function StatCard({ Icon, label, value }: { Icon: (p: SVG) => React.ReactElement; label: string; value: string | number }) {
  return (
    <div className="rounded-[16px] border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-ink-muted">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-rose/10 text-rose"><Icon /></span>
        <span className="text-[11px] font-semibold leading-tight">{label}</span>
      </div>
      <p className="mt-2.5 font-display text-[26px] font-bold leading-none text-ink">{value}</p>
    </div>
  );
}

function Panel({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <h2 className="font-display text-[15px] font-bold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; selected?: string }>;
}) {
  await requireAdminPage("/admin/applications");
  const { tab: tabParam, selected } = await searchParams;
  const tab: AppTab = (["awaiting", "changes", "approved", "rejected"] as const).includes(tabParam as AppTab) ? (tabParam as AppTab) : "awaiting";

  const [counts, rows, customerIds, roster] = await Promise.all([
    getApplicationCounts(),
    getApplicationsByTab(tab),
    listPendingCustomerIds(),
    getRecommendationRoster(),
  ]);

  // Inline review: selected row, or default to the first in the tab.
  const selectedId = selected || rows[0]?.userId || null;
  const detail = selectedId ? await getApplicationDetail(selectedId) : null;
  const locked = detail ? detail.status === "approved" || detail.status === "rejected" : false;

  const featuredCount = roster.rows.filter((r) => r.isRecommended && r.isActive).length;

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-5">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard Icon={StatIcons.pending} label="Pending Applications" value={counts.awaiting} />
        <StatCard Icon={StatIcons.approved} label="Approved Pros" value={counts.approved} />
        <StatCard Icon={StatIcons.changes} label="Changes Requested" value={counts.changes} />
        <StatCard Icon={StatIcons.rejected} label="Rejected" value={counts.rejected} />
        <StatCard Icon={StatIcons.id} label="Customer ID Checks" value={customerIds.length} />
        <StatCard Icon={StatIcons.featured} label="Active Featured Placements" value={featuredCount} />
        <StatCard Icon={StatIcons.revenue} label="Monthly Revenue" value={formatPrice(roster.stats.mrrCents)} />
      </div>

      {/* Middle split: queue (left) + review (right) */}
      <div className="grid gap-5 xl:grid-cols-[1fr_460px]">
        {/* Queue */}
        <Panel title="Pro Applications Queue">
          <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-4 py-3">
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <Link
                  key={t.key}
                  href={`/admin/applications?tab=${t.key}`}
                  scroll={false}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${active ? "border-rose bg-rose/10 text-rose" : "border-border text-ink-secondary hover:border-rose/40"}`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-rose/20 text-rose" : "bg-border/50 text-ink-muted"}`}>{counts[t.key]}</span>
                </Link>
              );
            })}
          </div>
          <div className="space-y-2.5 p-3">
            {rows.length === 0 ? (
              <div className="rounded-[14px] border border-border bg-bg p-8 text-center">
                <p className="font-semibold text-ink">{EMPTY[tab]}</p>
              </div>
            ) : (
              rows.map((a) => (
                <ApplicationQueueRow key={a.userId} app={a} tab={tab} selected={a.userId === selectedId} />
              ))
            )}
          </div>
        </Panel>

        {/* Review panel */}
        <Panel title="Application Review" aside={detail ? <span className="rounded-full bg-bg-elevated px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">ID · {detail.userId.slice(0, 8)}</span> : undefined}>
          {!detail ? (
            <div className="grid min-h-[280px] place-items-center px-6 py-12 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose/10 text-rose" aria-hidden>
                  <svg viewBox="0 0 24 24" width={22} height={22} {...s}><path d="M9 3h6l1 3h3v15H5V6h3l1-3Z" /><path d="M9 12h6M9 16h4" /></svg>
                </span>
                <p className="mt-3 font-semibold text-ink">Select an application to review.</p>
                <p className="mt-1 text-[12.5px] text-ink-muted">Pick a professional from the queue on the left.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5 p-4">
              {/* Identity header */}
              <div className="flex items-start gap-3">
                <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-rose/12 text-[20px] font-bold text-rose" aria-hidden>
                  {detail.businessName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold text-ink">{detail.businessName}</h3>
                  <p className="text-[12.5px] text-ink-secondary">{detail.primarySpecialty || "—"}</p>
                  <p className="text-[12px] text-ink-muted">{detail.city || "—"}{detail.email ? ` · ${detail.email}` : ""}</p>
                </div>
                <Link href={`/admin/applications/${detail.userId}`} className="flex-none text-[12px] font-semibold text-rose hover:underline">
                  Full page ↗
                </Link>
              </div>

              {detail.accountStatus === "banned" && (
                <div className="rounded-[12px] border border-danger/50 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
                  🚫 Account banned{detail.banReason ? ` — ${detail.banReason}` : ""}
                </div>
              )}

              {/* About */}
              {detail.bio && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-muted">About</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{detail.bio}</p>
                </div>
              )}

              {/* Portfolio */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Portfolio ({detail.portfolio.length})</p>
                <PortfolioGallery items={detail.portfolio} />
              </div>

              {/* Documents & ID */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-muted">Documents &amp; ID</p>
                <DocumentViewer documents={detail.documents} readOnly={locked || detail.accountStatus === "banned"} />
              </div>

              {/* Decision actions */}
              <VerificationReviewActions
                userId={detail.userId}
                businessName={detail.businessName}
                locked={locked}
                accountStatus={detail.accountStatus}
                unmetRequirements={detail.unmetRequirements}
              />
            </div>
          )}
        </Panel>
      </div>

      {/* Bottom row: Customer ID checks + Featured recommendations */}
      <div className="grid gap-5 xl:grid-cols-2">
        {/* Customer ID checks */}
        <Panel
          title="Customer ID Checks"
          aside={<Link href="/admin/verifications" className="text-[12px] font-semibold text-rose hover:underline">View all →</Link>}
        >
          <div className="p-3">
            {customerIds.length === 0 ? (
              <div className="rounded-[14px] border border-border bg-bg p-6 text-center">
                <p className="text-[13px] text-ink-muted">No customer IDs waiting for review.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {customerIds.slice(0, 5).map((c) => (
                  <CustomerIdReviewRow key={c.userId} row={c} />
                ))}
              </ul>
            )}
          </div>
        </Panel>

        {/* Featured recommendations */}
        <Panel
          title="Featured Recommendations · $2.99/mo"
          aside={<Link href="/admin/recommendations" className="text-[12px] font-semibold text-rose hover:underline">Manage all →</Link>}
        >
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-[12px] border border-border bg-bg p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Active subs</p>
                <p className="mt-1 font-display text-lg font-bold text-ink">{roster.stats.active}</p>
              </div>
              <div className="rounded-[12px] border border-border bg-bg p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Placements</p>
                <p className="mt-1 font-display text-lg font-bold text-ink">{featuredCount}</p>
              </div>
              <div className="rounded-[12px] border border-border bg-bg p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">MRR</p>
                <p className="mt-1 font-display text-lg font-bold text-ink">{formatPrice(roster.stats.mrrCents)}</p>
              </div>
            </div>
            <p className="text-[11px] text-ink-muted">
              Impression / click / conversion tracking isn&apos;t enabled yet — no estimated numbers shown.
            </p>
            {roster.rows.length === 0 ? (
              <div className="rounded-[14px] border border-border bg-bg p-6 text-center">
                <p className="text-[13px] text-ink-muted">No placements yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {roster.rows.slice(0, 5).map((r) => (
                  <li key={r.userId} className="flex items-center gap-2.5 py-2.5">
                    {r.avatarUrl ? (
                      <Image src={r.avatarUrl} alt="" width={34} height={34} className="h-[34px] w-[34px] flex-none rounded-full object-cover" />
                    ) : (
                      <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-rose/12 text-[13px] font-bold text-rose" aria-hidden>{r.name.slice(0, 1)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-ink">{r.name}</p>
                      <p className="truncate text-[11px] text-ink-muted">{r.specialty} · {r.city}</p>
                    </div>
                    <span className="flex-none text-[11px] text-ink-muted">{r.periodEnd ? fmtDate(r.periodEnd) : r.recommendedUntil ? fmtDate(r.recommendedUntil) : ""}</span>
                    <AdminRecommendToggle userId={r.userId} initialRecommended={r.isRecommended} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
