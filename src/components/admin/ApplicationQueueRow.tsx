import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/format";
import type { PendingApplication } from "@/lib/admin/verification-data";

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending", under_review: "Under review", needs_more_info: "Changes requested",
  approved: "Approved", rejected: "Rejected", draft: "Draft",
};

function ago(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One row in the left Pro Applications Queue. Clicking selects it (drives the
 *  right-hand review panel via ?selected=) without leaving the dashboard.
 *  Selected row gets the rose-gold border glow from the mock. */
export function ApplicationQueueRow({
  app,
  tab,
  selected,
}: {
  app: PendingApplication & { avatarUrl?: string | null };
  tab: string;
  selected: boolean;
}) {
  return (
    <Link
      href={`/admin/applications?tab=${tab}&selected=${app.userId}`}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-[14px] border bg-surface p-3 transition-colors",
        selected
          ? "border-rose shadow-[0_0_0_1px_rgba(215,160,143,0.5),0_8px_22px_rgba(215,160,143,0.18)]"
          : "border-border hover:border-rose/45",
      )}
    >
      {app.avatarUrl ? (
        <Image src={app.avatarUrl} alt="" width={44} height={44} className="h-11 w-11 flex-none rounded-full object-cover" />
      ) : (
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-rose/12 text-[15px] font-bold text-rose" aria-hidden>
          {app.businessName.slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-display text-[14.5px] font-bold text-ink">
          <span className="truncate">{app.businessName}</span>
          {app.accountStatus === "banned" && <span className="flex-none rounded-full bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold text-danger">BANNED</span>}
        </p>
        <p className="truncate text-[11.5px] text-ink-muted">{app.primarySpecialty || "—"} · {app.city || "—"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {app.portfolioCount > 0 && (
            <span className="rounded-full bg-success/[0.12] px-2 py-[3px] text-[9.5px] font-bold text-success">Portfolio uploaded</span>
          )}
          {app.documentCount > 0 && (
            <span className="rounded-full border border-rose/30 px-2 py-[3px] text-[9.5px] font-semibold text-rose">ID submitted</span>
          )}
        </div>
      </div>

      <div className="flex-none text-right">
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-bold",
          app.status === "approved" ? "bg-success/15 text-success"
            : app.status === "rejected" ? "bg-danger/15 text-danger"
              : app.status === "under_review" || app.status === "needs_more_info" ? "bg-gold/15 text-gold"
                : "bg-rose/15 text-rose",
        )}>
          {STATUS_LABEL[app.status] ?? app.status}
        </span>
        <p className="mt-1 text-[10.5px] text-ink-muted">{ago(app.submittedAt)}</p>
      </div>
    </Link>
  );
}
