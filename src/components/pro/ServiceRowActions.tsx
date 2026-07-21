"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { archiveServiceAction } from "@/lib/pro/actions";

export function ServiceRowActions({ serviceId }: { serviceId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Link href={`/pro/services/${serviceId}/edit`} className="text-sm font-semibold text-rose hover:underline">
        Edit
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("Archive this service? It will no longer be bookable or shown publicly.")) return;
          start(async () => {
            const res = await archiveServiceAction(serviceId);
            setMsg(res?.error ?? res?.success ?? null);
          });
        }}
        className="text-sm font-semibold text-ink-muted hover:text-danger disabled:opacity-50"
      >
        {pending ? "…" : "Archive"}
      </button>
      {msg && <span className="text-[11px] text-ink-muted">{msg}</span>}
    </div>
  );
}
