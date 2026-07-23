"use client";
import { useState, useTransition } from "react";
import { switchModeAction } from "@/lib/profile/mode-actions";
import { UserIcon, CalendarIcon } from "@/components/ui/icons";

/**
 * Customer/Professional mode selector for professional & both accounts — two large
 * side-by-side cards (not tiny pills). The active mode is rose-filled; the inactive
 * one is outlined. Tapping either always calls switchModeAction in that direction;
 * a failed DB update surfaces an inline error instead of silently pretending to work.
 */
export function ModeSwitcher({ activeMode }: { activeMode: "customer" | "professional" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const card = (
    mode: "customer" | "professional",
    label: string,
    Icon: (p: { width?: number; height?: number; className?: string }) => React.ReactElement,
  ) => {
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
        className={`flex min-h-[88px] flex-1 flex-col items-center justify-center gap-2 rounded-[16px] border px-3 py-3 text-sm font-semibold transition disabled:opacity-60 ${
          active
            ? "rose-gradient border-transparent text-[#2A1712] shadow-luxe"
            : "border-border bg-surface text-ink hover:border-rose active:scale-[0.99]"
        }`}
      >
        <Icon width={22} height={22} className={active ? "text-[#2A1712]" : "text-rose"} />
        {label}
      </button>
    );
  };

  return (
    <div>
      <div className="flex items-stretch gap-3" role="group" aria-label="Switch mode">
        {card("customer", "Customer Mode", UserIcon)}
        {card("professional", "Professional Mode", CalendarIcon)}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
