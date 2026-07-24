import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { VerifiedIcon } from "@/components/ui/icons";
import { FavoriteButton } from "@/components/marketplace/FavoriteButton";
import { CardMenu } from "@/components/recommended/CardMenu";
import { formatPrice, formatDistanceFor } from "@/lib/format";
import type { ProfessionalCardView } from "@/lib/data/model";

/** Editorial recommendation card — portfolio image left, details + actions right.
 *  All fields are live data; the availability pill comes from the pro's real
 *  weekly schedule (booking flow remains the source of truth for exact slots). */
export function RecommendedProCard({
  pro,
  favorited,
  nextOpening,
}: {
  pro: ProfessionalCardView;
  favorited: boolean;
  nextOpening: string | null;
}) {
  const cover = pro.coverUrl || pro.avatarUrl;
  const profileHref = `/professionals/${pro.slug}`;

  return (
    <article className="overflow-hidden rounded-[16px] border border-rose/[0.16] bg-surface shadow-[inset_0_1px_0_rgba(255,248,244,0.05),0_8px_26px_rgba(0,0,0,0.3)]">
      <div className="flex">
        {/* Portfolio image — the card's hero */}
        <Link href={profileHref} className="relative w-[32%] min-w-[92px] max-w-[118px] flex-none self-stretch" aria-label={`View ${pro.displayName}'s profile`}>
          <SmartImage
            src={cover}
            alt={`${pro.displayName} — portfolio`}
            width={336}
            height={420}
            className="h-full min-h-[118px] w-full object-cover"
          />
          {pro.isFeatured && (
            <span className="absolute left-1.5 top-1.5 rounded-[5px] bg-bg/80 px-1.5 py-[3px] text-[8.5px] font-extrabold uppercase tracking-[0.12em] text-rose-light backdrop-blur-sm">
              Featured
            </span>
          )}
          <span className="absolute bottom-1.5 right-1.5">
            <FavoriteButton professionalId={pro.userId} professionalSlug={pro.slug} initialFavorited={favorited} size={28} />
          </span>
        </Link>

        {/* Details */}
        <div className="min-w-0 flex-1 p-2.5">
          <div className="flex items-start justify-between gap-1">
            {/* Rose-gold serif name, like the mock */}
            <h3 className="flex min-w-0 items-center gap-1.5 font-display text-[14px] font-bold leading-tight text-rose-light">
              <Link href={profileHref} className="truncate">{pro.businessName || pro.displayName}</Link>
              {pro.isVerified && <VerifiedIcon width={13} height={13} className="flex-none text-gold" />}
            </h3>
            <CardMenu slug={pro.slug} name={pro.businessName || pro.displayName} />
          </div>
          {/* Single meta line: Specialty · City · distance (mock) */}
          <p className="mt-px truncate text-[10.5px] text-ink-muted">
            {pro.primarySpecialty} · {pro.city}
            {pro.distanceMi != null && ` · ${formatDistanceFor(pro.distanceMi, pro.hideExactPin)}`}
          </p>

          <p className="mt-1 flex items-center gap-1 text-[10.5px] text-ink-secondary">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor" className="flex-none text-gold" aria-hidden>
              <path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8L12 2Z" />
            </svg>
            <span className="font-bold text-ink">{pro.ratingAverage.toFixed(1)}</span>
            <span className="text-ink-muted">({pro.reviewCount})</span>
            {pro.startingPriceCents > 0 && (
              <span className="ml-auto font-semibold text-ink">
                <span className="font-normal text-ink-muted">Starts at </span>
                {formatPrice(pro.startingPriceCents)}
              </span>
            )}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-1">
            {nextOpening && (
              <span className="rounded-full bg-success/[0.12] px-1.5 py-0.5 text-[9px] font-bold text-success">
                Next: {nextOpening}
              </span>
            )}
            {pro.isVerified && (
              <span className="rounded-full border border-rose/30 px-1.5 py-0.5 text-[9px] font-semibold text-rose">
                Verified
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center justify-end gap-1.5">
            <Link
              href={profileHref}
              className="flex min-h-[32px] items-center whitespace-nowrap rounded-full border border-rose/45 px-2.5 text-[10.5px] font-semibold text-rose transition-colors hover:bg-rose/10 active:scale-[0.98]"
            >
              View Profile
            </Link>
            <Link
              href={`/book/${pro.slug}`}
              className="flex min-h-[32px] items-center whitespace-nowrap rounded-full rose-gradient px-3 text-[10.5px] font-bold text-[#2A1712] shadow-[0_6px_16px_rgba(215,160,143,0.3)] transition-transform active:scale-[0.98]"
            >
              Book Now
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
