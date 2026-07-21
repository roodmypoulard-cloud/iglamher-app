import "server-only";
import { searchProfessionalViews } from "@/lib/data/professionals";
import { getFavoriteProfessionalIds } from "@/lib/data/favorites";
import { getMyCustomerBookings } from "@/lib/booking/data";
import { DEFAULT_VIEWER } from "@/lib/data/seed";
import { recommend, type Recommendation } from "./engine";
import { buildShelf, type ShelfKey } from "./shelves";
import type { CategorySlug, ProfessionalCardView } from "@/lib/data/model";

/**
 * Personalized "Recommended for you" list, built from the signed-in customer's
 * real signals (favorites + past bookings → preferred categories + rebooking
 * affinity). Falls back to a quality-ranked list for anonymous/new customers.
 */
export async function getRecommendedForYou(limit = 8): Promise<Recommendation[]> {
  const [pros, favoriteIds, bookings] = await Promise.all([
    searchProfessionalViews({}),
    getFavoriteProfessionalIds(),
    getMyCustomerBookings(),
  ]);

  const pastProfessionalIds = Array.from(new Set(bookings.map((b) => b.professionalId)));

  // Preferred categories = categories of pros the customer favorited or booked.
  const affinityIds = new Set([...favoriteIds, ...pastProfessionalIds]);
  const preferredCategories = Array.from(
    new Set(pros.filter((p) => affinityIds.has(p.userId)).flatMap((p) => p.categories)),
  ) as CategorySlug[];

  return recommend(pros, {
    viewer: DEFAULT_VIEWER,
    favoriteIds,
    pastProfessionalIds,
    preferredCategories: preferredCategories.length ? preferredCategories : undefined,
  }, limit);
}

/** Build any named shelf (recommended, trending, top_rated, new, available_today, luxury). */
export async function getShelf(key: ShelfKey, limit = 8): Promise<ProfessionalCardView[]> {
  if (key === "recommended") return getRecommendedForYou(limit);
  const pros = await searchProfessionalViews({});
  return buildShelf(key, pros, DEFAULT_VIEWER, limit);
}
