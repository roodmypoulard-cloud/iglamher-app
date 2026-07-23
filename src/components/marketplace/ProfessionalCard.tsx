import Link from "next/link";
import Image from "next/image";
import { SmartImage } from "@/components/ui/SmartImage";
import type { ProfessionalCardView } from "@/lib/data/model";
import { formatPrice, formatDistance, cn } from "@/lib/format";
import { VerifiedIcon } from "@/components/ui/icons";
import { Rating } from "@/components/ui/Rating";
import { FavoriteButton } from "./FavoriteButton";

function locationLabel(pro: ProfessionalCardView): string {
  if (pro.locationType === "in_salon") return `Studio · ${pro.city}`;
  if (pro.locationType === "mobile") return `Mobile · ${pro.city}`;
  return `Studio & mobile · ${pro.city}`;
}

export function ProfessionalCard({
  pro,
  favorited = false,
  variant = "grid",
}: {
  pro: ProfessionalCardView;
  favorited?: boolean;
  variant?: "grid" | "list" | "featured";
}) {
  const href = `/professionals/${pro.slug}`;
  const cover = pro.coverUrl || pro.avatarUrl;

  if (variant === "list") {
    return (
      <Link
        href={href}
        className="group flex items-stretch gap-3.5 rounded-[16px] border border-border bg-surface p-3 shadow-[0_6px_20px_rgba(0,0,0,0.20)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-rose/50 hover:shadow-[0_16px_36px_rgba(0,0,0,0.34)] [will-change:transform]"
      >
        <div className="relative aspect-square h-[76px] flex-none overflow-hidden rounded-[13px]">
          <Image
            src={pro.avatarUrl}
            alt=""
            fill
            sizes="76px"
            className="img-luxe object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="flex items-center gap-1.5 font-display text-[17px] font-semibold leading-tight">
            <span className="truncate">{pro.displayName}</span>
            {pro.isVerified && <VerifiedIcon width={14} height={14} className="flex-none text-rose" />}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{pro.primarySpecialty || pro.headline}</p>
          <p className="mt-1.5 flex items-center gap-x-2 truncate text-[11.5px] text-ink-muted">
            <Rating average={pro.ratingAverage} count={pro.reviewCount} className="text-[11.5px]" />
            {pro.distanceMi != null && <span className="flex-none">· {formatDistance(pro.distanceMi)}</span>}
            {pro.startingPriceCents > 0 && (
              <span className="flex-none">· {formatPrice(pro.startingPriceCents, { from: true })}</span>
            )}
          </p>
        </div>
        <FavoriteButton professionalId={pro.userId} professionalSlug={pro.slug} initialFavorited={favorited} />
      </Link>
    );
  }

  const featured = variant === "featured";
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[16px] border border-border bg-surface",
        "shadow-[0_10px_30px_rgba(0,0,0,0.24)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-1 hover:border-rose/50 hover:shadow-[0_22px_50px_rgba(0,0,0,0.42)] [will-change:transform]",
        featured && "min-w-[260px]",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <SmartImage
          src={cover}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="img-luxe object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        {pro.isFeatured && (
          <span className="absolute left-3 top-3 rounded-full rose-gradient px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#2A1712]">
            Featured
          </span>
        )}
        <div className="absolute right-3 top-3">
          <FavoriteButton professionalId={pro.userId} professionalSlug={pro.slug} initialFavorited={favorited} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-4 py-5">
        <p className="flex items-center gap-1.5 font-display text-lg font-semibold leading-tight">
          {pro.displayName}
          {pro.isVerified && <VerifiedIcon width={14} height={14} className="text-rose" />}
        </p>
        <p className="truncate text-xs text-ink-muted">{pro.primarySpecialty || pro.headline}</p>
        <p className="mt-1 flex items-center gap-2 text-[12px]">
          <Rating average={pro.ratingAverage} count={pro.reviewCount} className="text-[12px]" />
        </p>
        <p className="mt-auto flex items-center justify-between pt-2 text-[11.5px] text-ink-muted">
          <span className="truncate">{locationLabel(pro)}</span>
          {pro.startingPriceCents > 0 && (
            <span className="flex-none font-semibold text-ink">{formatPrice(pro.startingPriceCents, { from: true })}</span>
          )}
        </p>
        {pro.distanceMi != null && (
          <p className="text-[11px] text-ink-muted">{formatDistance(pro.distanceMi)}</p>
        )}
      </div>
    </Link>
  );
}
