import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { getAuditLog } from "@/lib/admin/verification-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log · Admin · iGlamHer" };

// Human labels for the action vocabulary (verification_events.action).
const ACTION_LABEL: Record<string, string> = {
  submitted: "Application submitted", resubmitted: "Application resubmitted", opened: "Opened for review",
  approved: "Approved", rejected: "Rejected", needs_more_info: "Changes requested", changes_requested: "Changes requested",
  note: "Internal note", doc_verified: "Document verified", doc_flagged: "Document flagged",
  suspended: "Account suspended", unsuspended: "Account reactivated", banned: "Account banned", unbanned: "Account unbanned",
  verified_on: "Verified badge on", verified_off: "Verified badge off", featured_on: "Featured on", featured_off: "Featured off",
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approvals" },
  { key: "rejected", label: "Rejections" },
  { key: "needs_more_info", label: "Change requests" },
  { key: "doc_flagged", label: "Doc flags" },
  { key: "banned", label: "Bans" },
  { key: "suspended", label: "Suspensions" },
];

const DESTRUCTIVE = new Set(["rejected", "banned", "suspended", "doc_flagged"]);
const POSITIVE = new Set(["approved", "doc_verified", "verified_on", "featured_on", "unbanned", "unsuspended"]);

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requireAdminPage("/admin/audit-log");
  const { action } = await searchParams;
  const filter = action ?? "all";
  const entries = await getAuditLog(filter);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1000px] px-5 py-8 md:px-8">
      <Link href="/admin/applications" className="text-sm text-rose hover:underline">← Applications</Link>
      <h1 className="mt-3 font-display text-2xl font-bold">Audit log</h1>
      <p className="mt-1 text-sm text-ink-muted">Every moderation action, newest first. Read-only.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link key={f.key} href={`/admin/audit-log?action=${f.key}`} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${active ? "border-rose bg-rose/10 text-rose" : "border-border text-ink-secondary hover:border-rose/40"}`}>
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-surface text-[12px] uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Target</th>
              <th className="px-4 py-3 font-semibold">By</th>
              <th className="px-4 py-3 font-semibold">Detail</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">When</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-muted">No entries.</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-t border-border/60 align-top">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${DESTRUCTIVE.has(e.action) ? "bg-danger/15 text-danger" : POSITIVE.has(e.action) ? "bg-success/15 text-success" : "bg-border/40 text-ink-secondary"}`}>
                      {ACTION_LABEL[e.action] ?? e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink">{e.targetName}</td>
                  <td className="px-4 py-3 text-ink-secondary">{e.actorName}</td>
                  <td className="px-4 py-3 text-ink-muted">{e.body ? <span className="line-clamp-2">{e.body}</span> : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{fmt(e.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
