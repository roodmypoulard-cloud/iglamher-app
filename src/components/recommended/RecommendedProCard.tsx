import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { VerifiedIcon } from "@/components/ui/icons";
import { FavoriteButton } from "@/components/marketplace/FavoriteButton";
import { formatPrice, formatDistance } from "@/lib/format";
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
    <article className="overflow-hidden rounded-[22px] border border-rose/[0.16] bg-surface shadow-[inset_0_1px_0_rgba(255,248,244,0.05),0_8px_26px_rgba(0,0,0,0.3)]">
      <div className="flex">
        {/* Portfolio image — the card's hero */}
        <Link href={profileHref} className="relative w-[38%] min-w-[124px] max-w-[168px] flex-none self-stretch" aria-label={`View ${pro.displayName}'s profile`}>
          <SmartImage
            src={cover}
            alt={`${pro.displayName} — portfolio`}
            width={336}
            height={420}
            className="h-full min-h-[176px] w-full object-cover"
          />
          {pro.isFeatured && (
            <span className="absolute left-2 top-2 rounded-[6px] bg-bg/80 px-2 py-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-rose-light backdrop-blur-sm">
              Featured
            </span>
          )}
          <span className="absolute bottom-2 right-2">
            <FavoriteButton professionalId={pro.userId} professionalSlug={pro.slug} initialFavorited={favorited} />
          </span>
        </Link>

        {/* Details */}
        <div className="min-w-0 flex-1 p-3.5">
          <h3 className="flex items-center gap-1.5 font-display text-[17px] font-bold leading-tight text-ink">
            <Link href={profileHref} className="truncate">{pro.businessName || pro.displayName}</Link>
            {pro.isVerified && <VerifiedIcon width={15} height={15} className="flex-none text-gold" />}
          </h3>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-secondary">{pro.primarySpecialty}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
            {pro.city}
            {pro.distanceMi != null && ` · ${formatDistance(pro.distanceMi)}`}
          </p>

          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-secondary">
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

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {nextOpening && (
              <span className="rounded-full bg-success/[0.12] px-2.5 py-1 text-[10.5px] font-bold text-success">
                Next: {nextOpening}
              </span>
            )}
            {pro.isVerified && (
              <span className="rounded-full border border-rose/30 px-2.5 py-1 text-[10.5px] font-semibold text-rose">
                Verified
              </span>
            )}
            {pro.locationType !== "in_salon" && (
              <span className="rounded-full border border-border px-2.5 py-1 text-[10.5px] font-semibold text-ink-muted">
                {pro.locationType === "mobile" ? "Mobile" : "Mobile · Studio"}
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Link
              href={profileHref}
              className="flex min-h-[40px] items-center whitespace-nowrap rounded-full border border-border px-3.5 text-[12.5px] font-semibold text-ink-secondary transition-colors hover:border-rose/50 hover:text-ink active:scale-[0.98]"
            >
              View Profile
            </Link>
            <Link
              href={`/book/${pro.slug}`}
              className="flex min-h-[40px] items-center whitespace-nowrap rounded-full rose-gradient px-4 text-[12.5px] font-bold text-[#2A1712] shadow-[0_6px_16px_rgba(215,160,143,0.3)] transition-transform active:scale-[0.98]"
            >
              Book Now
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
