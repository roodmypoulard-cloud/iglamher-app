import Link from "next/link";
import { SmartImage } from "@/components/ui/SmartImage";
import { VerifiedIcon } from "@/components/ui/icons";
import { formatPrice } from "@/lib/format";
import type { ProfessionalCardView } from "@/lib/data/model";

/** Full-bleed editorial "cover story" — a real pro's portfolio photo with a
 *  magazine-style overlay. The hero of the Lookbook. Not a gradient block. */
export function LookbookCover({ pro }: { pro: ProfessionalCardView }) {
  const cover = pro.coverUrl || pro.avatarUrl;
  return (
    <Link
      href={`/professionals/${pro.slug}`}
      className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[22px] border border-gold/25 shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:aspect-[16/11]"
    >
      <SmartImage
        src={cover}
        alt={`${pro.displayName} — featured look`}
        fill
        priority
        sizes="(max-width: 640px) 100vw, 640px"
        className="img-luxe object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.05]"
      />
      {/* Editorial gradient — deep at the base for legible cover type */}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
      <span aria-hidden className="absolute inset-0 bg-[radial-gradient(90%_55%_at_25%_8%,rgba(240,192,180,0.18),transparent_60%)]" />

      {/* Masthead kicker */}
      <span className="absolute left-5 right-5 top-5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-rose-light">Cover story</span>
        <span className="rounded-full bg-black/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-rose-light backdrop-blur-sm">
          ★ Featured
        </span>
      </span>

      {/* Cover title block */}
      <span className="absolute inset-x-5 bottom-5 block">
        <span className="flex items-center gap-1.5">
          <span className="font-display text-[27px] font-semibold leading-none text-ink drop-shadow-[0_2px_14px_rgba(0,0,0,0.8)]">
            {pro.displayName}
          </span>
          {pro.isVerified && <VerifiedIcon width={17} height={17} className="text-gold" />}
        </span>
        <span className="mt-1.5 block max-w-[26ch] text-[12.5px] leading-snug text-ink-secondary drop-shadow-[0_1px_8px_rgba(0,0,0,0.9)]">
          {pro.headline || pro.primarySpecialty}
        </span>
        <span className="mt-3 flex items-center gap-2.5 text-[12px] text-ink-secondary">
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" width={13} height={13} fill="currentColor" className="text-gold" aria-hidden><path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8L12 2Z" /></svg>
            <span className="font-bold text-ink">{pro.ratingAverage.toFixed(1)}</span>
            <span className="text-ink-muted">({pro.reviewCount})</span>
          </span>
          {pro.startingPriceCents > 0 && <span className="text-ink-muted">· from {formatPrice(pro.startingPriceCents)}</span>}
          <span className="ml-auto inline-flex items-center rounded-full rose-gradient px-4 py-2 text-[12px] font-bold text-[#2A1712] shadow-[0_8px_20px_rgba(215,160,143,0.35)]">
            Book the look →
          </span>
        </span>
      </span>
    </Link>
  );
}
