"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sheet } from "@/components/ui/Modal";
import { cn } from "@/lib/format";

const RADII = [5, 10, 25, 50, 100] as const;

/** "Recommended near Los Angeles, CA · Change" — the Change sheet adjusts the
 *  search radius (a real server-side filter). iGlamHer's launch market is
 *  Greater LA, so the area itself is fixed for now — no fake city switching. */
export function AreaControl() {
  const router = useRouter();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const distance = Number(sp.get("distance")) || null;

  function setRadius(mi: number | null) {
    const next = new URLSearchParams(sp.toString());
    if (mi == null) next.delete("distance");
    else next.set("distance", String(mi));
    next.delete("limit");
    const qs = next.toString();
    router.push(qs ? `/recommended?${qs}` : "/recommended");
    setOpen(false);
  }

  return (
    <>
      <div className="flex min-h-[48px] items-center gap-2 rounded-[14px] border border-border bg-surface px-3.5">
        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="flex-none text-rose" aria-hidden>
          <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <p className="min-w-0 flex-1 truncate text-[13px] text-ink-secondary">
          Recommended near <span className="font-semibold text-ink">Los Angeles, CA</span>
          {distance ? <span className="text-ink-muted"> · within {distance} mi</span> : null}
        </p>
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-[44px] flex-none items-center gap-0.5 text-[13px] font-semibold text-rose">
          Change
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Search area">
        <p className="mb-3 text-[13px] leading-relaxed text-ink-secondary">
          How far should we look for recommended professionals?
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRadius(null)}
            className={cn(
              "min-h-[44px] rounded-full border px-4 text-[13px] font-semibold transition-colors",
              distance == null ? "rose-gradient border-transparent text-[#2A1712]" : "border-border text-ink-secondary hover:border-rose/50",
            )}
          >
            Any distance
          </button>
          {RADII.map((mi) => (
            <button
              key={mi}
              type="button"
              onClick={() => setRadius(mi)}
              className={cn(
                "min-h-[44px] rounded-full border px-4 text-[13px] font-semibold transition-colors",
                distance === mi ? "rose-gradient border-transparent text-[#2A1712]" : "border-border text-ink-secondary hover:border-rose/50",
              )}
            >
              {mi} mi
            </button>
          ))}
        </div>
        <p className="mt-4 text-[11.5px] leading-relaxed text-ink-muted">
          iGlamHer is live across Greater Los Angeles — more cities are coming soon.
        </p>
      </Sheet>
    </>
  );
}
