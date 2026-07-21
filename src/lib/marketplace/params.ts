// URL <-> SearchParams. Keeps search/filter state shareable & restorable.
// Prices are expressed in whole dollars in the URL for readability; converted
// to integer cents for the ranking layer.
import type { SearchParams, SortKey } from "./ranking";
import type { CategorySlug, LocationType } from "@/lib/data/model";

const CATEGORIES: CategorySlug[] = ["hair", "makeup", "lashes", "nails", "stylist"];
const LOCATIONS: Array<LocationType | "all"> = ["all", "mobile", "in_salon", "both"];
const SORTS: SortKey[] = ["recommended", "nearest", "rating", "price_asc", "earliest"];

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function num(v: string | string[] | undefined): number | undefined {
  const s = first(v);
  if (s == null || s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function parseSearchParams(raw: RawParams): SearchParams {
  const category = first(raw.category) as CategorySlug | undefined;
  const location = first(raw.location) as LocationType | "all" | undefined;
  const sort = first(raw.sort) as SortKey | undefined;
  const minPrice = num(raw.minPrice);
  const maxPrice = num(raw.maxPrice);
  return {
    q: first(raw.q)?.trim() || undefined,
    category: category && CATEGORIES.includes(category) ? category : undefined,
    distanceMi: num(raw.distance),
    minRating: num(raw.rating),
    minPriceCents: minPrice != null ? Math.round(minPrice * 100) : undefined,
    maxPriceCents: maxPrice != null ? Math.round(maxPrice * 100) : undefined,
    location: location && LOCATIONS.includes(location) ? location : undefined,
    verifiedOnly: first(raw.verified) === "1",
    instantOnly: first(raw.instant) === "1",
    sort: sort && SORTS.includes(sort) ? sort : undefined,
  };
}

/** Build a URLSearchParams from a partial filter patch merged over current state. */
export function buildQuery(params: SearchParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.distanceMi != null) sp.set("distance", String(params.distanceMi));
  if (params.minRating != null) sp.set("rating", String(params.minRating));
  if (params.minPriceCents != null) sp.set("minPrice", String(Math.round(params.minPriceCents / 100)));
  if (params.maxPriceCents != null) sp.set("maxPrice", String(Math.round(params.maxPriceCents / 100)));
  if (params.location && params.location !== "all") sp.set("location", params.location);
  if (params.verifiedOnly) sp.set("verified", "1");
  if (params.instantOnly) sp.set("instant", "1");
  if (params.sort && params.sort !== "recommended") sp.set("sort", params.sort);
  return sp.toString();
}

export function activeFilterCount(params: SearchParams): number {
  let n = 0;
  if (params.category) n++;
  if (params.distanceMi != null) n++;
  if (params.minRating != null) n++;
  if (params.minPriceCents != null || params.maxPriceCents != null) n++;
  if (params.location && params.location !== "all") n++;
  if (params.verifiedOnly) n++;
  if (params.instantOnly) n++;
  return n;
}
