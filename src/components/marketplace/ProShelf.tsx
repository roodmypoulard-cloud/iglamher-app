import Link from "next/link";
import { ProfessionalCard } from "@/components/marketplace/ProfessionalCard";
import { ChevronRight } from "@/components/ui/icons";
import type { ProfessionalCardView } from "@/lib/data/model";

/** Horizontal, snap-scrolling shelf of professional cards with a titled header
 *  and an optional "See all" link. Used for Recommended / Popular rows. */
export function ProShelf({
  title,
  subtitle,
  icon,
  pros,
  favoritedIds,
  seeAllHref,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  pros: ProfessionalCardView[];
  favoritedIds: string[];
  seeAllHref?: string;
}) {
  if (pros.length === 0) return null;
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-display text-[19px] font-bold leading-none text-ink">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-[12px] text-ink-muted">{subtitle}</p>}
        </div>
        {seeAllHref && (
          <Link href={seeAllHref} className="inline-flex flex-none items-center gap-0.5 text-[12.5px] font-semibold text-rose hover:underline">
            See all <ChevronRight width={14} height={14} />
          </Link>
        )}
      </div>
      <div className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
        {pros.map((p) => (
          <div key={p.userId} className="w-[248px] flex-none snap-start">
            <ProfessionalCard pro={p} favorited={favoritedIds.includes(p.userId)} variant="featured" />
          </div>
        ))}
      </div>
    </section>
  );
}
