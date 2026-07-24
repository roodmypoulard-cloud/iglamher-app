import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { GoldVerifiedBadge } from "@/components/marketplace/GoldVerifiedBadge";
import type { ProfessionalCardView } from "@/lib/data/model";

/** Compact horizontal "Trending This Week" strip (spec §13). Ranked by real
 *  completed-booking count (most-booked proxy). */
export function TrendingStrip({ pros }: { pros: ProfessionalCardView[] }) {
  if (pros.length === 0) return null;
  return (
    <div className="scrollbar-none -mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1">
      {pros.map((p) => (
        <Link key={p.userId} href={`/professionals/${p.slug}`} className="w-[124px] flex-none">
          <span className="relative block aspect-square w-full overflow-hidden rounded-[14px] border border-border">
            <SmartImage src={p.coverUrl || p.avatarUrl} alt="" fill sizes="124px" className="object-cover" />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 p-2">
              <span className="truncate font-display text-[12px] font-bold text-ink drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">{p.displayName}</span>
              {p.isVerified && <GoldVerifiedBadge size={11} />}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
