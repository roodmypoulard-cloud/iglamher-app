import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { FavoriteButton } from "@/components/marketplace/FavoriteButton";
import { TrackedBookNow } from "@/components/marketplace/TrackedBookNow";
import { GoldVerifiedBadge } from "@/components/marketplace/GoldVerifiedBadge";
import { formatPrice } from "@/lib/format";
import { proBadges, BADGE_LABEL } from "@/lib/marketplace/badges";
import type { ProfessionalCardView } from "@/lib/data/model";

/** Portrait luxury professional card (spec §11): large portfolio image, gold
 *  verified seal by the name, ≤2 badges, rating, from-price, favorite + Book Now.
 *  All real data. Book Now → the existing /book flow. */
export function LuxeProCard({
  pro,
  favorited,
  width = 210,
}: {
  pro: ProfessionalCardView;
  favorited: boolean;
  width?: number;
}) {
  const cover = pro.coverUrl || pro.avatarUrl;
  const profileHref = `/professionals/${pro.slug}`;
  const badges = proBadges(pro);

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-[18px] border border-rose/25 bg-surface shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-rose/50 active:scale-[0.98]"
      style={{ width }}
    >
      <Link href={profileHref} className="relative block aspect-[3/4] w-full overflow-hidden" aria-label={`View ${pro.displayName}`}>
        <SmartImage
          src={cover}
          alt={`${pro.displayName} — portfolio`}
          fill
          sizes="210px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {/* Dark lower gradient so overlaid text stays legible */}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 to-transparent" />
        {/* Primary badge (top-left) — at most one on the image */}
        {badges[0] && (
          <span className={`absolute left-2.5 top-2.5 rounded-[7px] px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.08em] backdrop-blur-sm ${badges[0] === "pick" ? "gold-glossy" : "bg-bg/80 text-rose-light"}`}>
            {BADGE_LABEL[badges[0]]}
          </span>
        )}
        <span className="absolute right-2.5 top-2.5">
          <FavoriteButton professionalId={pro.userId} professionalSlug={pro.slug} initialFavorited={favorited} />
        </span>
        {/* Name block over the gradient */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="flex items-center gap-1 font-display text-[16px] font-bold leading-tight text-ink drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            <span className="truncate">{pro.businessName || pro.displayName}</span>
            {pro.isVerified && <GoldVerifiedBadge size={14} />}
          </p>
          <p className="truncate text-[11px] text-ink-secondary drop-shadow-[0_1px_6px_rgba(0,0,0,0.9)]">{pro.primarySpecialty}</p>
        </div>
      </Link>

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor" className="text-gold" aria-hidden><path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8L12 2Z" /></svg>
            <span className="font-bold text-ink">{pro.ratingAverage.toFixed(1)}</span>
            <span className="text-ink-muted">({pro.reviewCount})</span>
          </span>
          {pro.startingPriceCents > 0 && (
            <span className="text-[12px] text-ink-muted">
              <span className="font-normal">From </span>
              <span className="font-bold text-ink">{formatPrice(pro.startingPriceCents)}</span>
            </span>
          )}
        </div>
        <TrackedBookNow slug={pro.slug} source="luxe_card" />
      </div>
    </article>
  );
}
