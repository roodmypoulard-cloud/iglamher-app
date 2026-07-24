"use client";
import { useActionState } from "react";
import { setGatePasscodeAction, type GateResult } from "@/lib/admin/gate-actions";

const input = "w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-rose focus:outline-none";
const label = "mb-1 block text-[12px] font-semibold text-ink-secondary";

export function AdminPasscodeCard({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState<GateResult | undefined, FormData>(setGatePasscodeAction, undefined);
  return (
    <section className="rounded-[16px] border border-border bg-surface p-4">
      <h2 className="font-display text-base font-bold text-ink">Admin passcode</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">
        {configured
          ? "A passcode is required to open the admin area. Change it here anytime."
          : "Set a passcode to add a second lock on the admin area (recommended)."}
      </p>
      <form action={action} className="mt-3 max-w-sm space-y-2.5">
        {configured && (
          <div>
            <label className={label} htmlFor="currentPasscode">Current passcode</label>
            <input id="currentPasscode" name="currentPasscode" type="password" autoComplete="off" className={input} />
          </div>
        )}
        <div>
          <label className={label} htmlFor="newPasscode">{configured ? "New passcode" : "Passcode"}</label>
          <input id="newPasscode" name="newPasscode" type="password" autoComplete="off" placeholder="At least 4 characters" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="confirmPasscode">Confirm</label>
          <input id="confirmPasscode" name="confirmPasscode" type="password" autoComplete="off" className={input} />
        </div>
        {state && (state.ok
          ? <p className="text-[13px] font-semibold text-success">Passcode saved. You&apos;ll enter it next time.</p>
          : <p role="alert" className="text-[13px] text-danger">{state.error}</p>)}
        <button type="submit" disabled={pending} className="min-h-[42px] rounded-full rose-gradient px-5 text-[13px] font-bold text-[#2A1712] disabled:opacity-60">
          {pending ? "Saving…" : configured ? "Change passcode" : "Set passcode"}
        </button>
      </form>
    </section>
  );
}
