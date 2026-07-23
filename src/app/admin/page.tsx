import Link from "next/link";
import Image from "next/image";
import { AdminProRow } from "@/components/admin/AdminProRow";
import { getAllProfessionalsForAdmin } from "@/lib/data/professionals";
import { getPlatformOverview, getVerificationQueue, getOpenReports, getOpenDisputes, type QueueItem } from "@/lib/admin/data";
import { profileCompleteness } from "@/lib/marketplace/visibility";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { integrationStatus } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · iGlamHer" };

const SECTIONS = [
  { href: "/admin/applications", label: "Verifications", desc: "Approve new pros" },
  { href: "/admin/analytics", label: "Analytics", desc: "GMV, funnel, retention" },
  { href: "/admin/campaigns", label: "Campaigns", desc: "Promos & coupons" },
];

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
  const integrations = integrationStatus();

  const [pros, overview, verifQueue, reports, disputes] = await Promise.all([
    getAllProfessionalsForAdmin(),
    getPlatformOverview(),
    getVerificationQueue(),
    getOpenReports(),
    getOpenDisputes(),
  ]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1100px] px-5 py-8 md:px-8">
      <h1 className="font-display text-2xl font-bold">Admin · Operations</h1>
      <p className="mt-1 text-sm text-ink-muted">Platform health, verification, moderation, and trust &amp; safety.</p>
      {isDemo && (
        <div className="mt-4 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink-secondary">
          Preview mode — queues and destructive actions require a connected Supabase project and an admin session.
          Overview metrics below are computed from the seed roster.
        </div>
      )}

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

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Integrations</h2>
      <p className="mb-3 text-sm text-ink-muted">What&apos;s connected vs. waiting on an API key.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {integrations.map((i) => (
          <div key={i.key} className="rounded-[14px] border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{i.label}</span>
              <span className={`h-2.5 w-2.5 flex-none rounded-full ${i.configured ? "bg-success" : "bg-ink-muted/40"}`} aria-label={i.configured ? "connected" : "not configured"} />
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">{i.purpose}</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide">
              <span className={i.configured ? "text-success" : "text-ink-muted"}>{i.configured ? "Connected" : "Add key"}</span>
            </p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg font-semibold">Professionals</h2>
      <div className="space-y-3">
        {pros.map((p) => (
          <div key={p.userId} className="flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-surface p-4">
            <Image src={p.avatarUrl} alt="" width={44} height={44} className="h-11 w-11 rounded-[12px] object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold">{p.businessName}</p>
              <p className="text-[12px] text-ink-muted">
                {p.city} · {p.isVerified ? "Verified" : "Unverified"} · reliability {p.reliabilityScore} · completeness{" "}
                {Math.round(profileCompleteness(p) * 100)}%
              </p>
            </div>
            <AdminProRow userId={p.userId} active={p.isActive} featured={p.isFeatured} recommended={Boolean(p.isRecommended)} />
          </div>
        ))}
      </div>
    </div>
  );
}
