// Phase 3 marketplace domain model. Camel-cased mirror of the SQL schema.
// Money is integer cents. Times are minutes-from-midnight (local) or UTC ISO.

export type CategorySlug = "hair" | "makeup" | "lashes" | "nails" | "stylist";
export type LocationType = "mobile" | "in_salon" | "both";
export type MediaKind = "image" | "video" | "instagram";
export type VerificationStatus = "unverified" | "pending" | "verified";

export interface Category {
  id: string;
  slug: CategorySlug;
  name: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ServiceRow {
  id: string;
  professionalId: string;
  categorySlug: CategorySlug;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
  priceIsFrom: boolean;
  depositType: "full" | "percent" | "fixed" | "none";
  depositValue: number | null;
  locationType: LocationType;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  travelFeeCents: number | null;
  instantBook: boolean;
  isActive: boolean;
  isArchived: boolean; // deleted_at set
  sortOrder: number;
  images: string[];
  addonIds: string[];
}

export interface AddonRow {
  id: string;
  professionalId: string;
  name: string;
  priceCents: number;
  isActive: boolean;
}

export interface PortfolioRow {
  id: string;
  professionalId: string;
  kind: MediaKind;
  url?: string;
  thumbUrl?: string;
  caption?: string;
  serviceId?: string;
  categorySlug?: CategorySlug;
  isCover: boolean;
  isHidden: boolean;
  sortOrder: number;
}

// Weekly recurring hours; minutes are 0..1440 in the professional's timezone.
export interface AvailabilityRule {
  weekday: number; // 0=Sun..6=Sat
  startMinute: number;
  endMinute: number;
}

export interface AvailabilityException {
  startsAt: string; // UTC ISO
  endsAt: string; // UTC ISO
  isAvailable: boolean; // false = time off / blocked, true = extra hours
  reason?: string;
}

export interface ReviewRow {
  id: string;
  author: string;
  avatarUrl?: string;
  rating: number;
  body: string;
  serviceName: string;
  createdAt: string; // UTC ISO
  professionalResponse?: string;
  isPublished: boolean;
  verifiedBooking?: boolean; // review tied to a completed booking
  photos?: string[]; // client-submitted photo URLs
}

export interface Professional {
  userId: string;
  slug: string;
  businessName: string;
  displayName: string;
  avatarUrl: string;
  coverUrl: string;
  headline: string;
  bio: string;
  primarySpecialty: string;
  specialties: string[];
  languages: string[];
  yearsExperience: number;
  city: string;
  postalCode: string;
  locationType: LocationType;
  serviceRadiusMiles: number;
  lat: number;
  lng: number;
  timezone: string; // IANA, e.g. "America/Los_Angeles"
  isActive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  instantBook: boolean;
  ratingAverage: number;
  reviewCount: number;
  jobsCompleted: number;
  reliabilityScore: number; // 0–100, drives ranking + reliability badge
  instagramHandle: string;
  igFollowerCount: string;
  cancellationPolicy: string;
  // Related (denormalized for the fallback layer / profile page)
  services: ServiceRow[];
  addons: AddonRow[];
  portfolio: PortfolioRow[];
  reviews: ReviewRow[];
  availability: AvailabilityRule[];
  exceptions: AvailabilityException[];
}

// Derived, request-scoped view fields (distance depends on the viewer).
export interface ProfessionalCardView extends Professional {
  distanceMi?: number;
  startingPriceCents: number;
  categories: CategorySlug[];
  score?: number; // ranking score for debugging
}

export interface GeoPoint {
  lat: number;
  lng: number;
}
