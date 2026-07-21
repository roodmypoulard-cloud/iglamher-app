import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import type { Category } from "@/lib/data/model";

/**
 * Category row — rounded photo tiles with a label beneath, per the approved
 * Soft Luxe mockups (Hair · Makeup · Lashes · Stylist). Fits four across on
 * mobile; scrolls if more.
 */
export function CategoryTiles({ categories }: { categories: Category[] }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {categories.map((c) => (
        <Link key={c.id} href={`/categories/${c.slug}`} className="group flex flex-col">
          <div className="relative aspect-[20/27] w-full overflow-hidden rounded-[24px] border border-border/80 shadow-luxe transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-active:-translate-y-0.5 [will-change:transform]">
            <SmartImage
              src={c.imageUrl}
              alt={c.name}
              fill
              sizes="(max-width: 640px) 46vw, 220px"
              className="img-luxe object-cover transition-transform duration-[650ms] ease-out group-hover:scale-[1.07]"
            />
            {/* Luxury overlay — deep base for a legible label, warm champagne sheen below */}
            <span className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/12 to-transparent" />
            <span className="absolute inset-0 bg-[radial-gradient(85%_60%_at_50%_122%,rgba(201,154,75,0.20),transparent_70%)]" />
            <span className="absolute inset-x-0 bottom-0 p-4">
              <span className="font-display text-[21px] font-semibold leading-none text-ink drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
                {c.name}
              </span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
