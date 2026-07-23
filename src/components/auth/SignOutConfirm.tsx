"use client";
import { useState } from "react";
import { signOutAction } from "@/lib/auth/actions";
import { ChevronRight } from "@/components/ui/icons";

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

/** Sign-out row (matches the profile row style) that asks for confirmation first. */
export function SignOutConfirm() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex min-h-[64px] w-full items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-4 text-left transition-colors hover:border-danger/50 active:scale-[0.99]"
      >
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-danger/10 text-danger">
          <LogoutIcon />
        </span>
        <span className="flex-1 text-sm font-bold text-danger">Sign out</span>
        <ChevronRight width={18} height={18} className="flex-none text-ink-muted" />
      </button>
    );
  }

  return (
    <div className="rounded-[20px] border border-danger/40 bg-danger/5 p-4">
      <p className="text-sm font-semibold text-ink">Sign out of iGlamHer?</p>
      <p className="mt-0.5 text-[13px] text-ink-muted">You&apos;ll need to sign back in to book or manage your account.</p>
      <div className="mt-3 flex gap-2">
        <form action={signOutAction} className="flex-1">
          <button type="submit" className="min-h-[44px] w-full rounded-full bg-danger px-4 text-sm font-semibold text-white active:scale-[0.99]">Sign out</button>
        </form>
        <button type="button" onClick={() => setConfirming(false)} className="min-h-[44px] flex-1 rounded-full border border-border text-sm font-semibold text-ink active:scale-[0.99]">Cancel</button>
      </div>
    </div>
  );
}
