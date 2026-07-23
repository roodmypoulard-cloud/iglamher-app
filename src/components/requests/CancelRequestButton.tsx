"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelJobRequestAction } from "@/lib/requests/actions";

export function CancelRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-full border border-border py-3 text-[14px] font-semibold text-ink-secondary transition-colors hover:border-danger/50 hover:text-danger"
      >
        Cancel this request
      </button>
    );
  }

  return (
    <div className="rounded-[16px] border border-danger/30 bg-danger/[0.06] p-3.5">
      <p className="text-[13px] font-semibold text-ink">Cancel this request?</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">Professionals will no longer see it. This can&apos;t be undone.</p>
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await cancelJobRequestAction(id);
              if (!res.ok) { setError(res.error); return; }
              router.refresh();
            })
          }
          className="flex-1 rounded-full bg-danger py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="flex-1 rounded-full border border-border py-2.5 text-[13px] font-semibold text-ink-secondary"
        >
          Keep it
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
