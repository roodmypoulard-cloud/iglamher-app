import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { ChevronRight } from "@/components/ui/icons";
import type { Category } from "@/lib/data/model";

/**
 * Full-width horizontal category banner — a long left-to-right card used to
 * feature a category (Nails) beneath the 2×2 tile grid. Matches the tile
 * styling: same radius, shadow, grading, and serif label.
 */
export function CategoryBanner({ category }: { category: Category }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group relative mt-4 block aspect-[24/8] w-full overflow-hidden rounded-[24px] border border-border/80 shadow-luxe transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 [will-change:transform]"
    >
      <SmartImage
        src={category.imageUrl}
        alt={category.name}
        fill
        sizes="(max-width: 640px) 100vw, 900px"
        className="img-luxe object-cover object-[center_38%] transition-transform duration-[650ms] ease-out group-hover:scale-[1.05]"
      />
      {/* Left-weighted overlay so the label reads while the manicure shows on the right */}
      <span className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/45 to-transparent" />
      <span className="absolute inset-0 bg-[radial-gradient(60%_120%_at_0%_50%,rgba(201,154,75,0.16),transparent_70%)]" />
      <div className="absolute inset-y-0 left-0 flex flex-col justify-center gap-1 p-5">
        <span className="font-display text-[26px] font-semibold leading-none text-ink drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
          {category.name}
        </span>
        <span className="max-w-[62%] text-[12px] leading-snug text-ink-secondary">
          {category.description}
        </span>
      </div>
      <span className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-rose/40 bg-white/[0.06] text-rose backdrop-blur-sm transition-transform duration-300 group-hover:translate-x-0.5">
        <ChevronRight width={16} height={16} />
      </span>
    </Link>
  );
}
