"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SmartImage } from "@/components/ui/SmartImage";
import { GoldVerifiedBadge } from "@/components/marketplace/GoldVerifiedBadge";
import { formatPrice } from "@/lib/format";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/format";
import type { ProfessionalCardView } from "@/lib/data/model";

/**
 * Editorial center-snap carousel of iGlamHer-RECOMMENDED professionals only.
 * The centered card is full-size + gold glow; neighbors scale ~0.82 and dim.
 * Every card carries the iGlamHer crown (recommended) and the gold verified
 * seal by the name (verified). Manual scroll/swipe — no autoplay. Tap centers,
 * then opens the profile. Respects prefers-reduced-motion.
 */
export function RecommendedCarousel({ pros }: { pros: ProfessionalCardView[] }) {
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    itemsRef.current.forEach((el, i) => {
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(elCenter - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActive((prev) => (prev === best ? prev : best));
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let raf = 0;
    const handler = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(onScroll); };
    scroller.addEventListener("scroll", handler, { passive: true });
    onScroll();
    return () => { scroller.removeEventListener("scroll", handler); cancelAnimationFrame(raf); };
  }, [onScroll]);

  const centerTo = (i: number) => {
    itemsRef.current[i]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const onSelect = (i: number, p: ProfessionalCardView) => {
    if (i !== active) { centerTo(i); return; } // first tap centers, second opens
    track("professional_viewed", { professionalId: p.userId, source: "recommended_carousel" });
    router.push(`/professionals/${p.slug}`);
  };

  if (pros.length === 0) return null;

  return (
    <div>
      <div
        ref={scrollerRef}
        className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[26%] py-2"
        role="listbox"
        aria-label="iGlamHer recommended professionals"
      >
        {pros.map((p, i) => {
          const on = i === active;
          const cover = p.coverUrl || p.avatarUrl;
          return (
            <button
              key={p.userId}
              ref={(el) => { itemsRef.current[i] = el; }}
              type="button"
              role="option"
              aria-selected={on}
              aria-label={`${p.businessName || p.displayName}, iGlamHer recommended`}
              onClick={() => onSelect(i, p)}
              className={cn(
                "relative aspect-[3/4] w-[172px] flex-none snap-center overflow-hidden rounded-[20px] border transition-[transform,opacity,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none",
                on
                  ? "scale-100 border-gold opacity-100 shadow-[0_0_28px_rgba(201,154,75,0.45)] active:scale-[0.98] motion-reduce:scale-100"
                  : "scale-[0.82] border-rose/20 opacity-55 motion-reduce:scale-90 motion-reduce:opacity-70",
              )}
            >
              <SmartImage src={cover} alt="" fill sizes="172px" className="object-cover" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/25 to-transparent" />

              {/* iGlamHer crown — every card here is a recommended pick */}
              <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full gold-glossy px-2 py-1">
                <svg viewBox="0 0 24 24" width={11} height={11} fill="#2a1c08" aria-hidden><path d="M4 17h16l-1-7.5-3.6 2.8L12 6l-3.4 6.3L5 9.5 4 17Zm0 2.4h16V21H4v-1.6Z" /></svg>
                <span className="text-[8.5px] font-extrabold uppercase tracking-[0.08em] text-[#2a1c08]">Pick</span>
              </span>

              <span className="absolute inset-x-0 bottom-0 p-3 text-center">
                <span className="flex items-center justify-center gap-1 font-display text-[16px] font-bold leading-tight text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
                  <span className="truncate">{p.businessName || p.displayName}</span>
                  {p.isVerified && <GoldVerifiedBadge size={13} />}
                </span>
                <span className="mt-0.5 flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-rose-light drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">
                  <span className="truncate">{p.primarySpecialty}</span>
                </span>
                <span className="mt-1 flex items-center justify-center gap-2 text-[10.5px] text-ink-secondary">
                  <span className="flex items-center gap-0.5">
                    <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" className="text-gold" aria-hidden><path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8L12 2Z" /></svg>
                    {p.ratingAverage.toFixed(1)}
                  </span>
                  {p.startingPriceCents > 0 && <span>· from {formatPrice(p.startingPriceCents)}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Dots stay visually small; each sits in a 44px-tall padded button so
          the hit area meets the tap-target minimum. */}
      <div className="mt-1 flex items-center justify-center" aria-hidden>
        {pros.map((p, i) => (
          <button
            key={p.userId}
            type="button"
            tabIndex={-1}
            onClick={() => centerTo(i)}
            className="grid h-11 min-w-[30px] place-items-center px-1"
          >
            <span className={cn("h-1.5 rounded-full transition-all duration-200", i === active ? "w-4 bg-gold" : "w-1.5 bg-rose/30")} />
          </button>
        ))}
      </div>
    </div>
  );
}
