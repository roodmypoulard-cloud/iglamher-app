"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { switchModeAction, enterProfessionalModeAction } from "@/lib/profile/mode-actions";
import { UserIcon, CalendarIcon, ChevronRight } from "@/components/ui/icons";

const Crown = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className={className} aria-hidden>
    <path d="M3 17h18l-1.2-8.6-4 3.1L12 4.5 8.2 11.5l-4-3.1L3 17Zm0 2.2h18V21H3v-1.8Z" />
  </svg>
);
const DashIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M4 20V10M9 20V4M14 20v-7M19 20V8" />
  </svg>
);

export function ProfileModeCard({
  accountType,
  activeMode,
  proComplete,
}: {
  accountType: "customer" | "professional" | "both";
  activeMode: "customer" | "professional";
  proComplete: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const typeLabel = accountType === "both" ? "Customer & Professional" : accountType === "professional" ? "Beauty Professional" : "Customer";

  const pill = (mode: "customer" | "professional", label: string, Icon: typeof UserIcon) => {
    const active = activeMode === mode;
    return (
      <button
        type="button"
        disabled={pending}
        aria-pressed={active}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await switchModeAction(mode);
            // On success the action redirects; only a failed update returns here.
            if (res?.error) setError(res.error);
          })
        }
        className={`flex min-h-[38px] flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition disabled:opacity-60 ${
          active ? "rose-gradient text-[#2A1712]" : "border border-border text-ink hover:border-rose/50"
        }`}
      >
        <Icon width={16} height={16} />
        {label}
      </button>
    );
  };

  return (
    <div className="rounded-[20px] border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-rose">Account Type</span>
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">{typeLabel} <Crown className="text-rose" /></span>
      </div>

      <div className="my-2 border-t border-border/60" />

      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-ink-muted">Current Mode</span>
        <span className="text-[12.5px] font-bold text-rose">{activeMode === "professional" ? "Professional Mode" : "Customer Mode"}</span>
      </div>

      <div className="mt-2 flex gap-2">
        {pill("customer", "Customer Mode", UserIcon)}
        {pill("professional", "Professional Mode", CalendarIcon)}
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}

      {/* Dashboard entry must ALSO switch into professional mode — a plain link left
          active_mode on "customer" and the pro shell read as broken (the mode pills
          above switch correctly; this row has to as well). Incomplete setup goes to
          /pro/apply and doesn't need the switch. */}
      {proComplete ? (
        <form action={enterProfessionalModeAction} className="mt-2.5">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[16px] border border-rose/40 bg-gradient-to-br from-rose/[0.14] to-surface p-2.5 text-left transition-transform active:scale-[0.99]"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-rose/15 text-rose">
              <DashIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-rose">Go to Professional Dashboard</p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-secondary">Manage your services, availability, earnings &amp; more</p>
            </div>
            <ChevronRight width={18} height={18} className="flex-none text-rose" />
          </button>
        </form>
      ) : (
        <Link
          href="/pro/apply"
          className="mt-2.5 flex items-center gap-3 rounded-[16px] border border-rose/40 bg-gradient-to-br from-rose/[0.14] to-surface p-2.5 transition-transform active:scale-[0.99]"
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-rose/15 text-rose">
            <DashIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-rose">Complete Professional Setup</p>
            <p className="mt-0.5 truncate text-[11.5px] text-ink-secondary">Finish your setup to start taking bookings and get discovered</p>
          </div>
          <ChevronRight width={18} height={18} className="flex-none text-rose" />
        </Link>
      )}
    </div>
  );
}
