"use client";
import { useTransition } from "react";
import { switchModeAction } from "@/lib/profile/mode-actions";

/** Customer/Professional mode toggle for professional & both accounts. */
export function ModeSwitcher({ activeMode }: { activeMode: "customer" | "professional" }) {
  const [pending, start] = useTransition();
  const btn = (mode: "customer" | "professional", label: string) => {
    const active = activeMode === mode;
    return (
      <button
        type="button"
        disabled={pending || active}
        aria-pressed={active}
        onClick={() => start(() => switchModeAction(mode))}
        className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
          active ? "rose-gradient text-[#2A1712]" : "border border-border text-ink hover:border-rose disabled:opacity-60"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface p-1" role="group" aria-label="Switch mode">
      {btn("customer", "Customer")}
      {btn("professional", "Professional")}
    </div>
  );
}
