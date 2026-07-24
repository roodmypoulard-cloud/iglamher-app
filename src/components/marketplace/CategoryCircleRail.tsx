"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { SmartImage } from "@/components/ui/SmartImage";
import { cn } from "@/lib/format";
import type { CategorySlug } from "@/lib/data/model";

const DISPLAY: Record<string, string> = { stylist: "Stylist" };

/** Horizontal circular category selector (spec §5). Active = gold halo + brighter
 *  label + champagne underline. Selecting filters the professionals below via the
 *  `category` query param (real, server-side). Smooth, no bounce. */
export function CategoryCircleRail({
  categories,
}: {
  categories: Array<{ slug: CategorySlug; name: string; imageUrl: string }>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const active = sp.get("category");

  const select = (slug: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (slug == null || slug === active) next.delete("category");
    else next.set("category", slug);
    const qs = next.toString();
    router.replace(qs ? `/categories?${qs}#pros` : "/categories#pros", { scroll: false });
  };

  return (
    <div role="tablist" aria-label="Service category" className="scrollbar-none -mx-5 flex gap-4 overflow-x-auto px-5 py-1">
      {categories.map((c) => {
        const on = active === c.slug;
        return (
          <button
            key={c.slug}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => select(c.slug)}
            className="flex min-w-[58px] flex-none flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "relative block h-[58px] w-[58px] overflow-hidden rounded-full ring-1 transition-[transform,box-shadow,--tw-ring-color] duration-200 ease-out",
                on ? "scale-[1.06] ring-2 ring-gold shadow-[0_0_16px_rgba(201,154,75,0.45)]" : "ring-rose/25",
              )}
            >
              <SmartImage src={c.imageUrl} alt="" fill sizes="58px" className="object-cover" />
            </span>
            <span className={cn("text-[10.5px] font-semibold leading-none transition-colors", on ? "text-ink" : "text-ink-secondary")}>
              {DISPLAY[c.slug] ?? c.name}
            </span>
            <span
              aria-hidden
              className={cn("h-[2px] rounded-full bg-gradient-to-r from-gold to-rose transition-all duration-200", on ? "w-5 opacity-100" : "w-0 opacity-0")}
            />
          </button>
        );
      })}
    </div>
  );
}
