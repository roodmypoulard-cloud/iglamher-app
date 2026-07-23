import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getApplicationCounts, getApplicationsByTab, type AppTab } from "@/lib/admin/verification-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pro applications · Admin · iGlamHer" };

const TABS: { key: AppTab; label: string }[] = [
  { key: "awaiting", label: "Awaiting review" },
  { key: "changes", label: "Changes requested" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending", under_review: "Under review", needs_more_info: "Changes requested", approved: "Approved", rejected: "Rejected",
};

const EMPTY: Record<AppTab, string> = {
  awaiting: "No applications awaiting review 🎉",
  changes: "Nobody has an open change request.",
  approved: "No approved pros yet.",
  rejected: "No rejected applications.",
};

function ago(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminApplicationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdminPage("/admin/applications");
  const { tab: tabParam } = await searchParams;
  const tab: AppTab = (["awaiting", "changes", "approved", "rejected"] as const).includes(tabParam as AppTab) ? (tabParam as AppTab) : "awaiting";

  const [counts, rows] = await Promise.all([getApplicationCounts(), getApplicationsByTab(tab)]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1000px] px-5 py-8 md:px-8">
      <div className="flex items-center justify-between">
        <Link href="/admin" className="text-sm text-rose hover:underline">← Admin</Link>
        <Link href="/admin/audit-log" className="text-sm text-ink-muted hover:text-rose hover:underline">Audit log →</Link>
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold">Pro applications</h1>
      <p className="mt-1 text-sm text-ink-muted">Review portfolio, documents, ID, and links — then approve, request changes, reject, or ban.</p>

      {/* Tabs with live counts */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          const n = counts[t.key];
          return (
            <Link
              key={t.key}
              href={`/admin/applications?tab=${t.key}`}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${active ? "border-rose bg-rose/10 text-rose" : "border-border text-ink-secondary hover:border-rose/40"}`}
            >
              {t.label}
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? "bg-rose/20 text-rose" : "bg-border/50 text-ink-muted"}`}>{n}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-[16px] border border-border bg-surface p-8 text-center">
            <p className="font-semibold text-ink">{EMPTY[tab]}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((a) => (
              <li key={a.userId}>
                <Link
                  href={`/admin/applications/${a.userId}`}
                  className="flex flex-wrap items-center gap-4 rounded-[16px] border border-border bg-surface p-4 transition-colors hover:border-rose/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-display text-base font-semibold text-ink">
                      <span className="truncate">{a.businessName}</span>
                      {a.accountStatus === "banned" && <span className="flex-none rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger">BANNED</span>}
                      {a.accountStatus === "suspended" && <span className="flex-none rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">SUSPENDED</span>}
                    </p>
                    <p className="truncate text-[12px] text-ink-muted">
                      {a.primarySpecialty} · {a.city} · {a.portfolioCount} photos · {a.documentCount} docs · {tab === "awaiting" || tab === "changes" ? "submitted" : "updated"} {ago(a.submittedAt)}
                    </p>
                  </div>
                  <span className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-bold ${a.status === "under_review" ? "bg-gold/15 text-gold" : a.status === "approved" ? "bg-success/15 text-success" : a.status === "rejected" ? "bg-danger/15 text-danger" : a.status === "needs_more_info" ? "bg-gold/15 text-gold" : "bg-rose/15 text-rose"}`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  <span className="flex-none text-sm font-semibold text-rose">Review →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
