"use client";
import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Sheet } from "@/components/ui/Modal";
import { cn } from "@/lib/format";

const RADII = [5, 10, 25, 50, 100] as const;

/** Dark luxury location pill (brief §2): pin + "Los Angeles, CA" + chevron in a
 *  glassy gold-outlined capsule. Opens a real search-area sheet — radius feeds
 *  the `distance` param, which the page's queries consume server-side. */
export function LocationPill() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const distance = Number(sp.get("distance")) || null;

  function setRadius(mi: number | null) {
    const next = new URLSearchParams(sp.toString());
    if (mi == null) next.delete("distance");
    else next.set("distance", String(mi));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Search area: Los Angeles, CA${distance ? `, within ${distance} miles` : ""}. Change`}
        className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-gold/40 bg-surface/60 px-3.5 text-[12px] font-semibold text-ink-secondary backdrop-blur-sm transition-colors hover:border-gold/70"
      >
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="flex-none text-gold" aria-hidden>
          <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span className="text-ink">Los Angeles, CA</span>
        {distance && <span className="text-ink-muted">· {distance} mi</span>}
        <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-none text-ink-muted" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Search area">
        <p className="mb-3 text-[13px] leading-relaxed text-ink-secondary">How far should we look?</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRadius(null)} className={cn("min-h-[44px] rounded-full border px-4 text-[13px] font-semibold transition-colors", distance == null ? "rose-gradient border-transparent text-[#2A1712]" : "border-border text-ink-secondary hover:border-rose/50")}>
            Any distance
          </button>
          {RADII.map((mi) => (
            <button key={mi} type="button" onClick={() => setRadius(mi)} className={cn("min-h-[44px] rounded-full border px-4 text-[13px] font-semibold transition-colors", distance === mi ? "rose-gradient border-transparent text-[#2A1712]" : "border-border text-ink-secondary hover:border-rose/50")}>
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
