"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { setProfessionalVerifiedAction, setProfessionalActiveAction } from "@/lib/admin/actions";
import type { PendingPro } from "@/lib/admin/data";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AdminVerificationRow({ pro }: { pro: PendingPro }) {
  const [state, setState] = useState<"pending" | "approved" | "rejected">("pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function approve() {
    setError(null);
    start(async () => {
      const r = await setProfessionalVerifiedAction(pro.userId, true);
      if (r.ok) setState("approved");
      else setError(r.error);
    });
  }

  function reject() {
    setError(null);
    start(async () => {
      const r = await setProfessionalActiveAction(pro.userId, false);
      if (r.ok) setState("rejected");
      else setError(r.error);
    });
  }

  if (state !== "pending") {
    return (
      <div className="flex items-center justify-between rounded-[14px] border border-border bg-surface px-4 py-3 text-sm">
        <span className="font-medium text-ink">{pro.businessName}</span>
        <span className={state === "approved" ? "font-semibold text-success" : "font-semibold text-ink-muted"}>
          {state === "approved" ? "✓ Approved — now live" : "Rejected (hidden)"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-border bg-surface p-4">
      <div className="relative h-12 w-12 flex-none overflow-hidden rounded-[12px] bg-bg-elevated">
        {pro.avatarUrl ? (
          <Image src={pro.avatarUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-lg text-ink-muted" aria-hidden>
            {pro.businessName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold text-ink">{pro.businessName}</p>
        <p className="truncate text-[12px] text-ink-muted">
          {pro.displayName} · {pro.city} · {pro.servicesCount} {pro.servicesCount === 1 ? "service" : "services"} · signed up {fmtDate(pro.createdAt)}
        </p>
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>
      <div className="flex flex-none items-center gap-2">
        <Link
          href={`/professionals/${pro.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[40px] rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink hover:border-rose/50"
        >
          Preview
        </Link>
        <button
          type="button"
          onClick={reject}
          disabled={busy}
          className="min-h-[40px] rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink-muted hover:text-danger disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          className="min-h-[40px] rounded-full rose-gradient px-5 py-2 text-sm font-semibold text-[#2A1712] active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
