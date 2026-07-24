import type { Professional } from "@/lib/data/model";
import { deriveBadges, BADGE_META, type TrustBadge } from "@/lib/trust/badges";

/**
 * Derive display badges from a professional's public record.
 *
 * C4: each badge comes from its OWN admin-approved column. Previously every
 * badge was derived from the single `isVerified` flag (and license/insured were
 * hard-coded false), so an approved pro was labeled "Identity Verified" whether
 * or not an ID had actually been checked. A pro can never set these — migration
 * 0033's column guard rejects any self-write.
 */
export function professionalBadges(pro: Professional): TrustBadge[] {
  return deriveBadges({
    identityVerified: pro.identityVerified,
    licenseVerified: pro.licenseVerified,
    insured: pro.insuranceVerified,
    homeStudioReviewed: pro.homeStudioReviewed,
    salonLocationVerified: pro.salonLocationVerified,
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
          // `title` carries the specific meaning, so the short label can never be
          // read as a broader guarantee than what was actually checked.
          title={BADGE_META[b].description}
          className={`inline-flex items-center gap-1 rounded-full border border-rose/40 bg-rose/10 font-semibold text-rose ${pad}`}
        >
          <span aria-hidden>{BADGE_META[b].icon}</span> {BADGE_META[b].label}
        </span>
      ))}
    </div>
  );
}
