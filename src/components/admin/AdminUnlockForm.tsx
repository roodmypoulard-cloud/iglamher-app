"use client";
import { useActionState } from "react";
import { unlockGateAction, type GateResult } from "@/lib/admin/gate-actions";

export function AdminUnlockForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<GateResult | undefined, FormData>(unlockGateAction, undefined);
  return (
    <form action={action} className="mt-6 w-full space-y-3">
      <input type="hidden" name="next" value={next} />
      <input
        type="password"
        name="passcode"
        autoFocus
        autoComplete="off"
        inputMode="text"
        aria-label="Admin passcode"
        placeholder="Passcode"
        className="w-full rounded-[12px] border border-border bg-surface px-4 py-3.5 text-center text-[16px] tracking-[0.3em] text-ink placeholder:tracking-normal placeholder:text-ink-muted focus:border-rose focus:outline-none"
      />
      {state && !state.ok && <p role="alert" className="text-center text-[13px] text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="min-h-[48px] w-full rounded-full rose-gradient text-[15px] font-bold text-[#2A1712] transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
