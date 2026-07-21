import type { Professional } from "@/lib/data/model";
import { deriveBadges, BADGE_META, type TrustBadge } from "@/lib/trust/badges";

/**
 * Derive display badges from a professional's public record. We only assert
 * badges we have data for (identity verification + reputation); license/insured/
 * background populate from the verification workflow once documents are reviewed.
 */
export function professionalBadges(pro: Professional): TrustBadge[] {
  return deriveBadges({
    identityVerified: pro.isVerified,
    licenseVerified: false,
    insured: false,
    backgroundChecked: false,
    ratingAverage: pro.ratingAverage,
    reviewCount: pro.reviewCount,
    reliabilityScore: pro.reliabilityScore,
  });
}

export function TrustBadges({ badges, size = "md" }: { badges: TrustBadge[]; size?: "sm" | "md" }) {
  if (badges.length === 0) return null;
  const pad = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[12px]";
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span
          key={b}
          className={`inline-flex items-center gap-1 rounded-full border border-rose/40 bg-rose/10 font-semibold text-rose ${pad}`}
        >
          <span aria-hidden>{BADGE_META[b].icon}</span> {BADGE_META[b].label}
        </span>
      ))}
    </div>
  );
}
