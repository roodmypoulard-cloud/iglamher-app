// Domain types — shared across the app. Money is always integer cents.

export type ServiceCategory = "hair" | "makeup" | "lashes" | "nails" | "stylist";
export type LocationMode = "mobile" | "in_salon" | "both";
export type MediaKind = "image" | "video" | "instagram";

export interface PortfolioItem {
  kind: MediaKind;
  url?: string;
  thumbUrl?: string;
}

export interface Service {
  id: string;
  category: ServiceCategory;
  name: string;
  description?: string;
  priceCents: number;
  priceIsFrom?: boolean;
  durationMin: number;
}

export interface Review {
  author: string;
  rating: number;
  body: string;
}

export interface Stylist {
  id: string;
  name: string;
  headline: string;
  categories: ServiceCategory[];
  locationMode: LocationMode;
  ratingAvg: number;
  ratingCount: number;
  jobsCompleted: number;
  distanceMi: number;
  instagramHandle: string;
  igFollowerCount: string;
  startingPriceCents: number;
  verified: boolean;
  avatarUrl: string;
  coverUrl: string;
  bio: string;
  portfolio: PortfolioItem[];
  services: Service[];
  reviews: Review[];
}

export interface CategoryDef {
  key: ServiceCategory;
  label: string;
  imageUrl: string;
}
