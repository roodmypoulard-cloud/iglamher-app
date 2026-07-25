// Public-visibility rules — enforced here in the service layer AND in the DB
// via RLS (0003/0004). A professional is only publicly discoverable when active.
import type { Professional, ServiceRow, PortfolioRow } from "@/lib/data/model";

/**
 * Inactive / suspended / onboarding-incomplete pros are never public, and
 * neither is a profile no admin has approved (isVerified — the listing gate,
 * which curated demo profiles also satisfy). Mirrors the live query filter
 * `is_active AND (is_verified OR is_demo)` so the service layer, single-profile
 * fetches, and seed data all enforce the same rule.
 */
export function isPubliclyVisible(pro: Pick<Professional, "isActive" | "isVerified">): boolean {
  return pro.isActive === true && pro.isVerified === true;
}

/** Services shown publicly: active, not archived (soft-deleted). */
export function publicServices(pro: Professional): ServiceRow[] {
  return pro.services
    .filter((s) => s.isActive && !s.isArchived)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Portfolio shown publicly: not hidden by moderation. */
export function publicPortfolio(pro: Professional): PortfolioRow[] {
  return pro.portfolio
    .filter((p) => !p.isHidden)
    .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder);
}

/** Reviews shown publicly: published only. */
export function publicReviews(pro: Professional) {
  return pro.reviews.filter((r) => r.isPublished);
}

/**
 * Profile completeness 0..1 — used for ranking and the admin completeness view.
 * Weighted checklist of the fields a polished public profile should have.
 */
export function profileCompleteness(pro: Professional): number {
  const checks: boolean[] = [
    Boolean(pro.avatarUrl),
    Boolean(pro.coverUrl),
    Boolean(pro.bio && pro.bio.length >= 40),
    Boolean(pro.primarySpecialty),
    pro.specialties.length > 0,
    Boolean(pro.city),
    pro.yearsExperience > 0,
    publicServices(pro).length > 0,
    publicPortfolio(pro).length >= 3,
    pro.availability.length > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}
