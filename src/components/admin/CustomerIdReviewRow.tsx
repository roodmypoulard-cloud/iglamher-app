"use client";
import { useState, useTransition } from "react";
import { approveCustomerIdAction, rejectCustomerIdAction } from "@/lib/admin/verification-actions";
import type { PendingCustomerId } from "@/lib/admin/verification-data";

/** One pending customer-ID check: who, the (signed, short-lived) document link,
 *  and the verdict buttons. Row disappears on verdict via revalidate. */
export function CustomerIdReviewRow({ row }: { row: PendingCustomerId }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const run = (verdict: "approved" | "rejected") =>
    start(async () => {
      setError(null);
      const res = verdict === "approved" ? await approveCustomerIdAction(row.userId) : await rejectCustomerIdAction(row.userId);
      if (res.ok) setDone(verdict);
      else setError(res.error);
    });

  if (done) {
    return (
      <li className="flex items-center justify-between rounded-[16px] border border-border bg-surface p-4 text-sm text-ink-muted">
        <span>
          {row.name} — ID {done}
        </span>
      </li>
    );
  }

  return (
    <li className="rounded-[16px] border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{row.name}</p>
          <p className="truncate text-[12px] text-ink-muted">{row.email}</p>
        </div>
        {row.documentUrl ? (
          <a
            href={row.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-rose/50 px-3.5 py-2 text-[13px] font-semibold text-rose hover:bg-rose/10"
          >
            View ID
          </a>
        ) : (
          <span className="text-[12px] text-ink-muted">No document</span>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run("approved")}
          className="rounded-full rose-gradient px-4 py-2 text-[13px] font-bold text-[#2A1712] disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run("rejected")}
          className="rounded-full border border-danger/60 px-4 py-2 text-[13px] font-semibold text-danger hover:bg-danger/10 disabled:opacity-60"
        >
          Reject
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </li>
  );
}
