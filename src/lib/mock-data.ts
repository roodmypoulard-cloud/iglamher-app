// ⚠️ DEVELOPMENT SEED LAYER — mock data only.
// Replaced by Supabase queries in Phase 2+. Never used in production paths.
import type { Stylist, CategoryDef } from "./types";

const img = (id: string, w = 600) =>
  `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;

export const CATEGORIES: CategoryDef[] = [
  { key: "hair", label: "Hair", imageUrl: img("photo-1560066984-138dadb4c035") },
  { key: "makeup", label: "Makeup", imageUrl: img("photo-1522335789203-aabd1fc54bc9") },
  { key: "lashes", label: "Lashes", imageUrl: img("photo-1583001931096-959e9a1a6223") },
  { key: "nails", label: "Nails", imageUrl: "/brand/categories/nails.jpg" },
  { key: "stylist", label: "Stylist", imageUrl: img("photo-1483985988355-763728e1935b") },
];

export const STYLISTS: Stylist[] = [
  {
    id: "maya-r",
    name: "Maya R.",
    headline: "Soft & full glam · lashes",
    categories: ["makeup", "lashes"],
    locationMode: "both",
    ratingAvg: 5.0,
    ratingCount: 128,
    jobsCompleted: 640,
    distanceMi: 0.5,
    instagramHandle: "mayaglam",
    igFollowerCount: "18.4k",
    startingPriceCents: 8500,
    verified: true,
    avatarUrl: img("photo-1544005313-94ddf0286df2", 200),
    coverUrl: img("photo-1487412947147-5cebf100ffc2", 900),
    bio: "LA-based MUA & lash artist. 6 years, 600+ faces. Clean, radiant, camera-ready glam that lasts all day. Bridal & events my specialty.",
    portfolio: [
      { kind: "image", url: img("photo-1596704017254-9b121068fb31") },
      { kind: "video" },
      { kind: "instagram" },
      { kind: "image", url: img("photo-1526045478516-99145907023c") },
      { kind: "image", url: img("photo-1522337660859-02fbefca4702") },
      { kind: "image", url: img("photo-1512257778941-a4a0bf8f0c8e") },
    ],
    services: [
      { id: "s1", category: "makeup", name: "Soft Glam", priceCents: 8500, durationMin: 45 },
      { id: "s2", category: "makeup", name: "Full Glam", priceCents: 12000, durationMin: 60 },
      { id: "s3", category: "makeup", name: "Bridal Makeup", priceCents: 20000, priceIsFrom: true, durationMin: 90 },
      { id: "s4", category: "lashes", name: "Classic Lash Set", priceCents: 9000, durationMin: 90 },
      { id: "s5", category: "lashes", name: "Volume Lash Set", priceCents: 13000, durationMin: 120 },
    ],
    reviews: [
      { author: "Jasmine T.", rating: 5, body: "Maya made my face look UNREAL. On time, so professional. Booking her for my wedding!" },
      { author: "Carlos M.", rating: 5, body: "Booked her for my fiancée. Best glam in LA, hands down." },
    ],
  },
  {
    id: "dee-styles",
    name: "Dee Styles",
    headline: "Braids · installs · protective styles",
    categories: ["hair"],
    locationMode: "mobile",
    ratingAvg: 4.9,
    ratingCount: 98,
    jobsCompleted: 530,
    distanceMi: 0.5,
    instagramHandle: "deestyles",
    igFollowerCount: "31.2k",
    startingPriceCents: 9000,
    verified: true,
    avatarUrl: img("photo-1531123897727-8f129e1688ce", 200),
    coverUrl: img("photo-1560869713-7d0a29430803", 900),
    bio: "Protective styles & flawless installs. Knotless braids, box braids, glueless & frontal wigs. Gentle on your edges, always neat.",
    portfolio: [
      { kind: "image", url: img("photo-1560869713-7d0a29430803") },
      { kind: "image", url: img("photo-1595959183082-7b570b7e08e2") },
      { kind: "video" },
      { kind: "instagram" },
      { kind: "image", url: img("photo-1522337094846-8a818192de1f") },
      { kind: "image", url: img("photo-1522336572468-97b06e8ef143") },
    ],
    services: [
      { id: "d1", category: "hair", name: "Knotless Braids", priceCents: 16000, priceIsFrom: true, durationMin: 240 },
      { id: "d2", category: "hair", name: "Box Braids", priceCents: 18000, priceIsFrom: true, durationMin: 300 },
      { id: "d3", category: "hair", name: "Glueless Wig Install", priceCents: 11000, durationMin: 90 },
      { id: "d4", category: "hair", name: "Frontal Install + Style", priceCents: 18000, priceIsFrom: true, durationMin: 120 },
    ],
    reviews: [
      { author: "Priya S.", rating: 5, body: "My knotless braids are PERFECT and she was so gentle. Lasted 8 weeks." },
      { author: "Tanya B.", rating: 4, body: "Great install, super neat. Will rebook." },
    ],
  },
  {
    id: "nina-k",
    name: "Nina K.",
    headline: "Silk press · blowouts · cuts",
    categories: ["hair"],
    locationMode: "both",
    ratingAvg: 5.0,
    ratingCount: 112,
    jobsCompleted: 470,
    distanceMi: 0.7,
    instagramHandle: "ninahairla",
    igFollowerCount: "12.8k",
    startingPriceCents: 5500,
    verified: true,
    avatarUrl: img("photo-1508214751196-bcfd4ca60f91", 200),
    coverUrl: img("photo-1519699047748-de8e457a634e", 900),
    bio: "Healthy-hair stylist. Silk presses with body & shine, precision cuts, bouncy blowouts. Natural hair specialist.",
    portfolio: [
      { kind: "image", url: img("photo-1519699047748-de8e457a634e") },
      { kind: "image", url: img("photo-1560066984-138dadb4c035") },
      { kind: "instagram" },
      { kind: "image", url: img("photo-1522337660859-02fbefca4702") },
      { kind: "video" },
      { kind: "image", url: img("photo-1500840216050-6ffa99d75160") },
    ],
    services: [
      { id: "n1", category: "hair", name: "Haircut & Style", priceCents: 5500, durationMin: 45 },
      { id: "n2", category: "hair", name: "Silk Press", priceCents: 8000, durationMin: 60 },
      { id: "n3", category: "hair", name: "Blowout", priceCents: 6500, durationMin: 45 },
    ],
    reviews: [
      { author: "Alexis W.", rating: 5, body: "Best silk press I've ever had — lasted almost 2 weeks. So sweet too." },
    ],
  },
  {
    id: "simone-v",
    name: "Simone V.",
    headline: "Personal & event stylist",
    categories: ["stylist"],
    locationMode: "both",
    ratingAvg: 4.95,
    ratingCount: 76,
    jobsCompleted: 210,
    distanceMi: 1.1,
    instagramHandle: "simonestyles",
    igFollowerCount: "22.1k",
    startingPriceCents: 12000,
    verified: true,
    avatarUrl: img("photo-1487412720507-e7ab37603c6f", 200),
    coverUrl: img("photo-1490481651871-ab68de25d43d", 900),
    bio: "Wardrobe & event stylist. I dress you for shoots, weddings, dates & red carpets — closet edits, outfit curation, head-to-toe looks.",
    portfolio: [
      { kind: "image", url: img("photo-1490481651871-ab68de25d43d") },
      { kind: "image", url: img("photo-1483985988355-763728e1935b") },
      { kind: "video" },
      { kind: "instagram" },
      { kind: "image", url: img("photo-1445205170230-053b83016050") },
      { kind: "image", url: img("photo-1469334031218-e382a71b716b") },
    ],
    services: [
      { id: "v1", category: "stylist", name: "Outfit Curation", priceCents: 12000, durationMin: 90 },
      { id: "v2", category: "stylist", name: "Event Styling", priceCents: 15000, priceIsFrom: true, durationMin: 120 },
      { id: "v3", category: "stylist", name: "Closet Edit", priceCents: 20000, priceIsFrom: true, durationMin: 180 },
    ],
    reviews: [
      { author: "Bianca L.", rating: 5, body: "Simone styled me for my engagement shoot — every look was perfect. Obsessed!" },
    ],
  },
];

export function getStylist(id: string): Stylist | undefined {
  return STYLISTS.find((s) => s.id === id);
}
