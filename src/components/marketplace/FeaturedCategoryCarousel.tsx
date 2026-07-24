"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SmartImage } from "@/components/ui/SmartImage";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/format";
import type { CategorySlug } from "@/lib/data/model";

export type FeaturedCategory = { slug: CategorySlug; name: string; imageUrl: string; proCount: number };

/**
 * Editorial center-snap category carousel (mock right panel). The centered card
 * is full-size + gold glow + full opacity; neighbors scale ~0.82 and dim ~0.55.
 * Manual scroll/swipe only — NO autoplay. Selecting a card filters the pros
 * below via ?category= (same as the circle rail). All scale/opacity transitions
 * respect prefers-reduced-motion via `motion-reduce:` utilities.
 */
export function FeaturedCategoryCarousel({ categories }: { categories: FeaturedCategory[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // Track which card is centered as the user scrolls (rAF-throttled).
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
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setActive((prev) => (prev === best ? prev : best));
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    let raf = 0;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(onScroll);
    };
    scroller.addEventListener("scroll", handler, { passive: true });
    onScroll();
    return () => {
      scroller.removeEventListener("scroll", handler);
      cancelAnimationFrame(raf);
    };
  }, [onScroll]);

  const centerTo = (i: number) => {
    const el = itemsRef.current[i];
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const onSelect = (i: number, c: FeaturedCategory) => {
    if (i !== active) {
      centerTo(i);
      return; // first tap centers; second tap (now active) navigates
    }
    track("category_viewed", { category: c.slug, source: "featured_carousel" });
    const next = new URLSearchParams(sp.toString());
    if (sp.get("category") === c.slug) next.delete("category");
    else next.set("category", c.slug);
    const qs = next.toString();
    router.replace(qs ? `/categories?${qs}#pros` : "/categories#pros", { scroll: false });
  };

  return (
    <div>
      <div
        ref={scrollerRef}
        className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[26%] py-2"
        role="listbox"
        aria-label="Featured categories"
      >
        {categories.map((c, i) => {
          const on = i === active;
          return (
            <button
              key={c.slug}
              ref={(el) => { itemsRef.current[i] = el; }}
              type="button"
              role="option"
              aria-selected={on}
              onClick={() => onSelect(i, c)}
              className={cn(
                "relative aspect-[3/4] w-[168px] flex-none snap-center overflow-hidden rounded-[20px] border transition-[transform,opacity,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none",
                on
                  ? "scale-100 border-gold opacity-100 shadow-[0_0_28px_rgba(201,154,75,0.45)] motion-reduce:scale-100"
                  : "scale-[0.82] border-rose/20 opacity-55 motion-reduce:scale-90 motion-reduce:opacity-70",
              )}
            >
              <SmartImage src={c.imageUrl} alt="" fill sizes="168px" className="object-cover" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-3 text-center">
                <span className="block font-display text-[17px] font-bold text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">{c.name}</span>
                <span className="mt-0.5 block text-[11px] font-semibold text-rose-light drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">{c.proCount}+ pros</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Pagination dots */}
      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden>
        {categories.map((c, i) => (
          <button
            key={c.slug}
            type="button"
            tabIndex={-1}
            onClick={() => centerTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              i === active ? "w-4 bg-gold" : "w-1.5 bg-rose/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}
