// ⚠️ DEVELOPMENT / DETERMINISTIC SEED LAYER
// Single source of truth for sample marketplace data. Consumed by:
//   • scripts/seed.ts  -> writes these rows into Supabase (npm run db:seed)
//   • src/lib/data/*    -> in-memory fallback when no live Supabase is configured
// Never used in production request paths once a real DB is connected.

import type {
  Category,
  Professional,
  ServiceRow,
  AddonRow,
  PortfolioRow,
  ReviewRow,
  AvailabilityRule,
  CategorySlug,
  LocationType,
} from "./model";

const img = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=70&auto=format&fit=crop`;

export const CATEGORY_IDS: Record<CategorySlug, string> = {
  hair: "11111111-1111-1111-1111-111111111101",
  makeup: "11111111-1111-1111-1111-111111111102",
  lashes: "11111111-1111-1111-1111-111111111103",
  nails: "11111111-1111-1111-1111-111111111105",
  stylist: "11111111-1111-1111-1111-111111111104",
};

export const CATEGORIES: Category[] = [
  {
    id: CATEGORY_IDS.hair,
    slug: "hair",
    name: "Hair",
    description: "Silk press, braids, installs, cuts & blowouts",
    imageUrl: "/brand/categories/hair.jpg",
    isActive: true,
    sortOrder: 1,
  },
  {
    id: CATEGORY_IDS.makeup,
    slug: "makeup",
    name: "Makeup",
    description: "Soft glam, full glam & bridal artistry",
    imageUrl: "/brand/categories/makeup.jpg",
    isActive: true,
    sortOrder: 2,
  },
  {
    id: CATEGORY_IDS.lashes,
    slug: "lashes",
    name: "Lashes",
    description: "Classic, hybrid & volume sets and fills",
    imageUrl: "/brand/categories/lashes.jpg",
    isActive: true,
    sortOrder: 3,
  },
  {
    id: CATEGORY_IDS.nails,
    slug: "nails",
    name: "Nails",
    description: "Luxury manicures, gel, structured overlays & nail art",
    imageUrl: "/brand/categories/nails.jpg",
    isActive: true,
    sortOrder: 4,
  },
  {
    id: CATEGORY_IDS.stylist,
    slug: "stylist",
    name: "Stylist",
    description: "Personal & event styling, closet edits",
    imageUrl: "/brand/categories/stylist.jpg",
    isActive: true,
    sortOrder: 5,
  },
];

// Standard weekly hours (Tue–Sat 9:00–18:00) unless a pro overrides.
const STD_HOURS: AvailabilityRule[] = [2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 18 * 60,
}));

let svcSeq = 0;
let addonSeq = 0;
let portSeq = 0;
let revSeq = 0;
const pad = (n: number) => n.toString(16).padStart(12, "0");
const svcId = () => `5e000000-0000-4000-8000-${pad(++svcSeq)}`;
const addonId = () => `ad000000-0000-4000-8000-${pad(++addonSeq)}`;
const portId = () => `b0000000-0000-4000-8000-${pad(++portSeq)}`;
const revId = () => `4e000000-0000-4000-8000-${pad(++revSeq)}`;

type SvcSpec = {
  proId: string;
  cat: CategorySlug;
  name: string;
  desc: string;
  min: number;
  cents: number;
  from?: boolean;
  loc?: LocationType;
  archived?: boolean;
  instant?: boolean;
  bufBefore?: number;
  bufAfter?: number;
  img?: string;
};

function svc(spec: SvcSpec, order: number): ServiceRow {
  return {
    id: svcId(),
    professionalId: spec.proId,
    categorySlug: spec.cat,
    name: spec.name,
    description: spec.desc,
    durationMin: spec.min,
    priceCents: spec.cents,
    priceIsFrom: spec.from ?? false,
    depositType: "percent",
    depositValue: 20,
    locationType: spec.loc ?? "both",
    bufferBeforeMin: spec.bufBefore ?? 0,
    bufferAfterMin: spec.bufAfter ?? 15,
    travelFeeCents: null,
    instantBook: spec.instant ?? false,
    isActive: !spec.archived,
    isArchived: spec.archived ?? false,
    sortOrder: order,
    images: spec.img ? [img(spec.img)] : [],
    addonIds: [],
  };
}

function addon(proId: string, name: string, cents: number): AddonRow {
  return { id: addonId(), professionalId: proId, name, priceCents: cents, isActive: true };
}

function port(
  proId: string,
  photoId: string | null,
  caption: string,
  order: number,
  opts: { cover?: boolean; hidden?: boolean; kind?: "image" | "video" | "instagram" } = {},
): PortfolioRow {
  return {
    id: portId(),
    professionalId: proId,
    kind: opts.kind ?? "image",
    url: photoId ? img(photoId, 900) : undefined,
    thumbUrl: photoId ? img(photoId, 400) : undefined,
    caption,
    isCover: opts.cover ?? false,
    isHidden: opts.hidden ?? false,
    sortOrder: order,
  };
}

function rev(
  author: string,
  rating: number,
  body: string,
  service: string,
  response?: string,
  photos?: string[],
): ReviewRow {
  return {
    id: revId(),
    author,
    rating,
    body,
    serviceName: service,
    createdAt: "2026-05-01T18:00:00.000Z",
    professionalResponse: response,
    isPublished: true,
    verifiedBooking: true,
    photos,
  };
}

// ---- helper to assemble a professional with sensible defaults ----
type ProSpec = Partial<Professional> & {
  userId: string;
  slug: string;
  businessName: string;
  displayName: string;
  city: string;
  lat: number;
  lng: number;
  services: ServiceRow[];
  portfolio: PortfolioRow[];
  reviews: ReviewRow[];
};

function pro(spec: ProSpec): Professional {
  const starting = Math.min(...spec.services.filter((s) => !s.isArchived).map((s) => s.priceCents));
  return {
    avatarUrl: img("photo-1544005313-94ddf0286df2", 240),
    coverUrl: img("photo-1487412947147-5cebf100ffc2", 1200),
    headline: "",
    bio: "",
    primarySpecialty: "",
    specialties: [],
    languages: ["English"],
    yearsExperience: 5,
    postalCode: "90001",
    locationType: "both",
    serviceRadiusMiles: 15,
    timezone: "America/Los_Angeles",
    isActive: true,
    isVerified: true,
    isFeatured: false,
    instantBook: false,
    ratingAverage: 5,
    reviewCount: spec.reviews.length,
    jobsCompleted: 100,
    reliabilityScore: 92,
    instagramHandle: "",
    igFollowerCount: "0",
    cancellationPolicy: "Free cancellation up to 48 hours before your appointment. Within 48 hours the deposit is non-refundable.",
    addons: [],
    availability: STD_HOURS,
    exceptions: [],
    ...spec,
    // computed, not overridable
    startingPriceCents: Number.isFinite(starting) ? starting : 0,
  } as Professional;
}

// ============================================================
// 12 professionals — varied location types, verification, cities,
// prices, ratings. #11 inactive (onboarding incomplete) and #12
// suspended/hidden — both must never appear in public marketplace.
// ============================================================

const P1 = "a0000000-0000-4000-8000-000000000001";
const P2 = "a0000000-0000-4000-8000-000000000002";
const P3 = "a0000000-0000-4000-8000-000000000003";
const P4 = "a0000000-0000-4000-8000-000000000004";
const P5 = "a0000000-0000-4000-8000-000000000005";
const P6 = "a0000000-0000-4000-8000-000000000006";
const P7 = "a0000000-0000-4000-8000-000000000007";
const P8 = "a0000000-0000-4000-8000-000000000008";
const P9 = "a0000000-0000-4000-8000-000000000009";
const P10 = "a0000000-0000-4000-8000-00000000000a";
const P11 = "a0000000-0000-4000-8000-00000000000b";
const P12 = "a0000000-0000-4000-8000-00000000000c";

export const PROFESSIONALS: Professional[] = [
  pro({
    userId: P1,
    slug: "maya-rose-beauty",
    businessName: "Maya Rose Beauty",
    displayName: "Maya R.",
    headline: "Soft & full glam · lashes",
    primarySpecialty: "Bridal & editorial makeup",
    specialties: ["Bridal", "Editorial", "Lashes", "Soft glam"],
    languages: ["English", "Spanish"],
    yearsExperience: 6,
    city: "Downtown LA",
    postalCode: "90014",
    lat: 34.0407,
    lng: -118.2468,
    locationType: "both",
    isVerified: true,
    isFeatured: true,
    isRecommended: true,
    instantBook: true,
    ratingAverage: 5.0,
    jobsCompleted: 640,
    instagramHandle: "mayaglam",
    igFollowerCount: "18.4k",
    avatarUrl: "/pros/bridal.jpg",
    coverUrl: "/pros/bridal.jpg",
    bio: "LA-based MUA & lash artist. 6 years, 600+ faces. Clean, radiant, camera-ready glam that lasts all day. Bridal & events my specialty.",
    addons: [
      addon(P1, "Lashes (strip)", 1500),
      addon(P1, "Airbrush finish", 2500),
      addon(P1, "Travel to you", 3000),
    ],
    services: [
      svc({ proId: P1, cat: "makeup", name: "Soft Glam", desc: "Natural, radiant everyday glam.", min: 45, cents: 8500, instant: true, img: "photo-1596704017254-9b121068fb31" }, 0),
      svc({ proId: P1, cat: "makeup", name: "Full Glam", desc: "Full-coverage, photo-ready.", min: 60, cents: 12000, instant: true }, 1),
      svc({ proId: P1, cat: "makeup", name: "Bridal Makeup", desc: "Trial + wedding-day application.", min: 90, cents: 20000, from: true }, 2),
      svc({ proId: P1, cat: "lashes", name: "Classic Lash Set", desc: "Timeless, natural length.", min: 90, cents: 9000 }, 3),
      svc({ proId: P1, cat: "lashes", name: "Volume Lash Set", desc: "Full, fluffy volume.", min: 120, cents: 13000 }, 4),
      svc({ proId: P1, cat: "nails", name: "Luxury Manicure", desc: "Clean, glossy nude finish with cuticle care.", min: 60, cents: 6500, instant: true }, 5),
      svc({ proId: P1, cat: "nails", name: "Gel Manicure", desc: "Long-wear gel in a refined, editorial shade.", min: 75, cents: 8000 }, 6),
    ],
    portfolio: [
      port(P1, "photo-1596704017254-9b121068fb31", "Bridal soft glam", 0, { cover: true }),
      port(P1, "photo-1526045478516-99145907023c", "Full glam for events", 1),
      port(P1, "photo-1522337660859-02fbefca4702", "Volume lashes", 2),
      port(P1, null, "Behind the chair", 3, { kind: "video" }),
      port(P1, "photo-1526045478516-99145907023c", "Editorial", 4),
    ],
    reviews: [
      rev(
        "Jasmine T.",
        5,
        "Maya made my face look UNREAL. On time, so professional. Booking her for my wedding!",
        "Bridal Makeup",
        "Thank you Jasmine! It was an honor 🤍",
        [img("photo-1596704017254-9b121068fb31", 400), img("photo-1526045478516-99145907023c", 400)],
      ),
      rev("Carlos M.", 5, "Booked her for my fiancée. Best glam in LA, hands down.", "Full Glam"),
    ],
  }),
  pro({
    userId: P2,
    slug: "dee-styles-studio",
    businessName: "Dee Styles Studio",
    displayName: "Dee Styles",
    headline: "Braids · installs · protective styles",
    primarySpecialty: "Protective styles & installs",
    specialties: ["Knotless braids", "Box braids", "Wig installs"],
    yearsExperience: 8,
    city: "Inglewood",
    postalCode: "90301",
    lat: 33.9617,
    lng: -118.3531,
    locationType: "mobile",
    serviceRadiusMiles: 25,
    isVerified: true,
    isFeatured: true,
    isRecommended: true,
    ratingAverage: 4.9,
    jobsCompleted: 530,
    instagramHandle: "deestyles",
    igFollowerCount: "31.2k",
    avatarUrl: "/pros/braids.jpg",
    coverUrl: "/pros/braids.jpg",
    bio: "Protective styles & flawless installs. Knotless braids, box braids, glueless & frontal wigs. Gentle on your edges, always neat.",
    services: [
      svc({ proId: P2, cat: "hair", name: "Knotless Braids", desc: "Lightweight, natural movement.", min: 240, cents: 16000, from: true, loc: "mobile", bufAfter: 30 }, 0),
      svc({ proId: P2, cat: "hair", name: "Box Braids", desc: "Classic, long-lasting.", min: 300, cents: 18000, from: true, loc: "mobile", bufAfter: 30 }, 1),
      svc({ proId: P2, cat: "hair", name: "Glueless Wig Install", desc: "Secure, natural hairline.", min: 90, cents: 11000, loc: "mobile" }, 2),
      svc({ proId: P2, cat: "hair", name: "Old Frontal Install", desc: "Archived legacy service.", min: 120, cents: 15000, loc: "mobile", archived: true }, 3),
    ],
    portfolio: [
      port(P2, "photo-1560869713-7d0a29430803", "Knotless install", 0, { cover: true }),
      port(P2, "photo-1595959183082-7b570b7e08e2", "Box braids", 1),
      port(P2, "photo-1522337094846-8a818192de1f", "Frontal melt", 2),
      port(P2, "photo-1522336572468-97b06e8ef143", "Protective style", 3),
    ],
    reviews: [
      rev("Priya S.", 5, "My knotless braids are PERFECT and she was so gentle. Lasted 8 weeks.", "Knotless Braids"),
      rev("Tanya B.", 4, "Great install, super neat. Will rebook.", "Glueless Wig Install"),
    ],
  }),
  pro({
    userId: P3,
    slug: "nina-k-hair",
    businessName: "Nina K Hair",
    displayName: "Nina K.",
    headline: "Silk press · blowouts · cuts",
    primarySpecialty: "Healthy natural hair",
    specialties: ["Silk press", "Blowouts", "Precision cuts"],
    yearsExperience: 7,
    city: "Culver City",
    postalCode: "90232",
    lat: 34.0211,
    lng: -118.3965,
    locationType: "both",
    isVerified: true,
    ratingAverage: 5.0,
    jobsCompleted: 470,
    instagramHandle: "ninahairla",
    igFollowerCount: "12.8k",
    avatarUrl: "/pros/naturalhair.jpg",
    coverUrl: "/pros/naturalhair.jpg",
    bio: "Healthy-hair stylist. Silk presses with body & shine, precision cuts, bouncy blowouts. Natural hair specialist.",
    services: [
      svc({ proId: P3, cat: "hair", name: "Haircut & Style", desc: "Shape-up and finish.", min: 45, cents: 5500 }, 0),
      svc({ proId: P3, cat: "hair", name: "Silk Press", desc: "Sleek, swingy, lasts weeks.", min: 60, cents: 8000, instant: true }, 1),
      svc({ proId: P3, cat: "hair", name: "Blowout", desc: "Bouncy volume.", min: 45, cents: 6500 }, 2),
    ],
    portfolio: [
      port(P3, "photo-1519699047748-de8e457a634e", "Silk press", 0, { cover: true }),
      port(P3, "photo-1560066984-138dadb4c035", "Cut & style", 1),
      port(P3, "photo-1500840216050-6ffa99d75160", "Blowout", 2),
    ],
    reviews: [rev("Alexis W.", 5, "Best silk press I've ever had — lasted almost 2 weeks. So sweet too.", "Silk Press")],
  }),
  pro({
    userId: P4,
    slug: "simone-v-styling",
    businessName: "Simone V Styling",
    displayName: "Simone V.",
    headline: "Personal & event stylist",
    primarySpecialty: "Wardrobe & event styling",
    specialties: ["Wardrobe", "Event styling", "Closet edits"],
    languages: ["English", "French"],
    yearsExperience: 9,
    city: "West Hollywood",
    postalCode: "90069",
    lat: 34.09,
    lng: -118.3617,
    locationType: "both",
    isVerified: true,
    isFeatured: true,
    isRecommended: true,
    ratingAverage: 4.95,
    jobsCompleted: 210,
    instagramHandle: "simonestyles",
    igFollowerCount: "22.1k",
    avatarUrl: "/pros/stylist.jpg",
    coverUrl: "/pros/stylist.jpg",
    bio: "Wardrobe & event stylist. I dress you for shoots, weddings, dates & red carpets — closet edits, outfit curation, head-to-toe looks.",
    services: [
      svc({ proId: P4, cat: "stylist", name: "Outfit Curation", desc: "One head-to-toe look.", min: 90, cents: 12000 }, 0),
      svc({ proId: P4, cat: "stylist", name: "Event Styling", desc: "Styling for your big moment.", min: 120, cents: 15000, from: true }, 1),
      svc({ proId: P4, cat: "stylist", name: "Closet Edit", desc: "Full wardrobe overhaul.", min: 180, cents: 20000, from: true }, 2),
    ],
    portfolio: [
      port(P4, "photo-1490481651871-ab68de25d43d", "Editorial look", 0, { cover: true }),
      port(P4, "photo-1445205170230-053b83016050", "Event styling", 1),
      port(P4, "photo-1469334031218-e382a71b716b", "Closet edit", 2),
    ],
    reviews: [rev("Bianca L.", 5, "Simone styled me for my engagement shoot — every look was perfect. Obsessed!", "Event Styling")],
  }),
  pro({
    userId: P5,
    slug: "bella-lash-lab",
    businessName: "Bella Lash Lab",
    displayName: "Bella O.",
    headline: "Lash artistry · studio only",
    primarySpecialty: "Volume lashes",
    specialties: ["Classic", "Hybrid", "Volume", "Fills"],
    languages: ["English", "Spanish"],
    yearsExperience: 5,
    city: "Pasadena",
    postalCode: "91101",
    lat: 34.1478,
    lng: -118.1445,
    locationType: "in_salon",
    isVerified: true,
    ratingAverage: 4.8,
    jobsCompleted: 320,
    instagramHandle: "bellalashlab",
    igFollowerCount: "9.6k",
    avatarUrl: "/pros/lashes.jpg",
    coverUrl: "/pros/lashes.jpg",
    bio: "Cozy Pasadena lash studio. Feather-light volume sets, retention that lasts. Comfortable, nap-worthy appointments.",
    services: [
      svc({ proId: P5, cat: "lashes", name: "Classic Full Set", desc: "One extension per lash.", min: 90, cents: 8000, loc: "in_salon", instant: true }, 0),
      svc({ proId: P5, cat: "lashes", name: "Hybrid Set", desc: "Classic + volume mix.", min: 105, cents: 10000, loc: "in_salon" }, 1),
      svc({ proId: P5, cat: "lashes", name: "Mega Volume", desc: "Maximum fluff & drama.", min: 135, cents: 13500, loc: "in_salon" }, 2),
      svc({ proId: P5, cat: "lashes", name: "2-Week Fill", desc: "Keep them full.", min: 60, cents: 5500, loc: "in_salon", instant: true }, 3),
      svc({ proId: P5, cat: "nails", name: "Structured Gel Overlay", desc: "Strengthening overlay, natural shape.", min: 90, cents: 9500, loc: "in_salon" }, 4),
      svc({ proId: P5, cat: "nails", name: "Luxury Manicure", desc: "Glossy, clean, editorial finish.", min: 60, cents: 6500, loc: "in_salon", instant: true }, 5),
    ],
    portfolio: [
      port(P5, "photo-1583001931096-959e9a1a6223", "Volume set", 0, { cover: true }),
      port(P5, "photo-1526045478516-99145907023c", "Hybrid", 1),
    ],
    reviews: [rev("Denise K.", 5, "Bella's retention is unreal. Three weeks and still full.", "Mega Volume")],
  }),
  pro({
    userId: P6,
    slug: "jade-glow-makeup",
    businessName: "Jade Glow Makeup",
    displayName: "Jade C.",
    headline: "Glowy, skin-first makeup — I come to you",
    primarySpecialty: "Natural glam",
    specialties: ["Skin-first", "Natural glam", "Airbrush"],
    languages: ["English", "Mandarin"],
    yearsExperience: 4,
    city: "Santa Monica",
    postalCode: "90401",
    lat: 34.0195,
    lng: -118.4912,
    locationType: "mobile",
    serviceRadiusMiles: 20,
    isVerified: true,
    instantBook: true,
    ratingAverage: 4.9,
    jobsCompleted: 180,
    instagramHandle: "jadeglow",
    igFollowerCount: "14.2k",
    avatarUrl: "/pros/naturalglam.jpg",
    coverUrl: "/pros/naturalglam.jpg",
    bio: "Skin-first, glowy makeup that photographs beautifully. Mobile across the Westside. Great for shoots, dates and brunch glam.",
    services: [
      svc({ proId: P6, cat: "makeup", name: "Glow Glam", desc: "Dewy, natural finish.", min: 50, cents: 9000, loc: "mobile", instant: true }, 0),
      svc({ proId: P6, cat: "makeup", name: "Airbrush Glam", desc: "Long-wear airbrush.", min: 70, cents: 13000, loc: "mobile" }, 1),
    ],
    portfolio: [
      port(P6, "photo-1522335789203-aabd1fc54bc9", "Glowy glam", 0, { cover: true }),
      port(P6, "photo-1487412947147-5cebf100ffc2", "On location", 1),
    ],
    reviews: [rev("Mei L.", 5, "Skin looked like glass. She travels too — so convenient.", "Glow Glam")],
  }),
  pro({
    userId: P7,
    slug: "crown-by-tori",
    businessName: "Crown by Tori",
    displayName: "Tori A.",
    headline: "Braids & natural hair · Long Beach studio",
    primarySpecialty: "Braiding",
    specialties: ["Feed-in braids", "Cornrows", "Twists"],
    yearsExperience: 10,
    city: "Long Beach",
    postalCode: "90802",
    lat: 33.7701,
    lng: -118.1937,
    locationType: "in_salon",
    isVerified: true,
    ratingAverage: 4.7,
    jobsCompleted: 410,
    instagramHandle: "crownbytori",
    igFollowerCount: "20.5k",
    avatarUrl: "/pros/crown.jpg",
    coverUrl: "/pros/crown.jpg",
    bio: "Ten years braiding. Feed-ins, cornrows, twists and kid-friendly styles in my Long Beach studio.",
    services: [
      svc({ proId: P7, cat: "hair", name: "Feed-in Braids", desc: "Sleek, scalp-friendly.", min: 180, cents: 12000, from: true, loc: "in_salon", bufAfter: 20 }, 0),
      svc({ proId: P7, cat: "hair", name: "Cornrows", desc: "Straight-backs or design.", min: 120, cents: 8000, loc: "in_salon" }, 1),
      svc({ proId: P7, cat: "hair", name: "Two-Strand Twists", desc: "Natural, low tension.", min: 150, cents: 10000, from: true, loc: "in_salon" }, 2),
    ],
    portfolio: [
      port(P7, "photo-1595959183082-7b570b7e08e2", "Feed-in braids", 0, { cover: true }),
      port(P7, "photo-1522337094846-8a818192de1f", "Cornrow design", 1),
    ],
    reviews: [rev("Kayla R.", 5, "My feed-ins were so neat and she was quick. Studio is beautiful.", "Feed-in Braids")],
  }),
  pro({
    userId: P8,
    slug: "lux-lash-bar",
    businessName: "Lux Lash Bar",
    displayName: "Priya N.",
    headline: "Lashes & brows · studio or mobile",
    primarySpecialty: "Hybrid lashes",
    specialties: ["Hybrid", "Brow lamination", "Lash lift"],
    languages: ["English", "Hindi"],
    yearsExperience: 6,
    city: "Glendale",
    postalCode: "91203",
    lat: 34.1425,
    lng: -118.2551,
    locationType: "both",
    isVerified: true,
    ratingAverage: 4.85,
    jobsCompleted: 260,
    instagramHandle: "luxlashbar",
    igFollowerCount: "11.1k",
    avatarUrl: "/pros/lashes.jpg",
    coverUrl: "/pros/lashes.jpg",
    bio: "Lashes, lifts and brow lamination. Studio in Glendale, mobile for bridal parties.",
    services: [
      svc({ proId: P8, cat: "lashes", name: "Hybrid Set", desc: "Texture + volume.", min: 100, cents: 9500 }, 0),
      svc({ proId: P8, cat: "lashes", name: "Lash Lift & Tint", desc: "Your own lashes, lifted.", min: 60, cents: 7000, instant: true }, 1),
      svc({ proId: P8, cat: "lashes", name: "Brow Lamination", desc: "Fluffy, defined brows.", min: 45, cents: 6000 }, 2),
    ],
    portfolio: [
      port(P8, "photo-1583001931096-959e9a1a6223", "Hybrid set", 0, { cover: true }),
      port(P8, "photo-1522337660859-02fbefca4702", "Brow lamination", 1),
    ],
    reviews: [rev("Sofia M.", 5, "Lash lift opened my eyes right up. Loved the brow lam too.", "Lash Lift & Tint")],
  }),
  pro({
    userId: P9,
    slug: "remy-cuts",
    businessName: "Remy Cuts",
    displayName: "Remy D.",
    headline: "Barbering & cuts — mobile",
    primarySpecialty: "Precision cuts",
    specialties: ["Fades", "Tapers", "Beard"],
    languages: ["English", "French"],
    yearsExperience: 3,
    city: "Burbank",
    postalCode: "91502",
    lat: 34.1808,
    lng: -118.309,
    locationType: "mobile",
    serviceRadiusMiles: 18,
    isVerified: false, // newer pro, not yet verified — still publicly visible (active)
    ratingAverage: 4.6,
    reviewCount: 1,
    jobsCompleted: 22,
    reliabilityScore: 76,
    instagramHandle: "remycuts",
    igFollowerCount: "2.1k",
    avatarUrl: "/pros/naturalhair.jpg",
    coverUrl: "/pros/naturalhair.jpg",
    bio: "Mobile barber bringing clean fades and beard work to your door across the Valley.",
    services: [
      svc({ proId: P9, cat: "hair", name: "Skin Fade", desc: "Clean, sharp fade.", min: 45, cents: 4500, loc: "mobile", instant: true }, 0),
      svc({ proId: P9, cat: "hair", name: "Cut & Beard", desc: "Full grooming.", min: 60, cents: 6000, loc: "mobile" }, 1),
    ],
    portfolio: [
      port(P9, "photo-1503951914875-452162b0f3f1", "Skin fade", 0, { cover: true }),
      // hidden item -> admin moderation / security test: must not be publicly readable
      port(P9, "photo-1521490878406-4a5a3d0a6f0e", "Flagged upload", 1, { hidden: true }),
    ],
    reviews: [rev("Marcus J.", 5, "On time, clean fade, came right to my apartment.", "Skin Fade")],
  }),
  pro({
    userId: P10,
    slug: "amara-beauty",
    businessName: "Amara Beauty",
    displayName: "Amara B.",
    headline: "Full glam & bridal — top rated",
    primarySpecialty: "Bridal glam",
    specialties: ["Bridal", "Full glam", "Mature skin"],
    languages: ["English", "Yoruba"],
    yearsExperience: 11,
    city: "Hollywood",
    postalCode: "90028",
    lat: 34.0928,
    lng: -118.3287,
    locationType: "both",
    isVerified: true,
    isFeatured: true,
    isRecommended: true,
    instantBook: true,
    ratingAverage: 5.0,
    jobsCompleted: 720,
    instagramHandle: "amarabeauty",
    igFollowerCount: "44.7k",
    avatarUrl: "/pros/bride.jpg",
    coverUrl: "/pros/bride.jpg",
    bio: "Eleven years of bridal & editorial. Flawless, long-wear glam for every skin tone. Trusted by 700+ clients.",
    addons: [addon(P10, "Extra lashes", 2000), addon(P10, "Touch-up kit", 3500)],
    services: [
      svc({ proId: P10, cat: "makeup", name: "Signature Glam", desc: "Amara's signature look.", min: 60, cents: 11000, instant: true }, 0),
      svc({ proId: P10, cat: "makeup", name: "Bridal Trial + Day", desc: "Trial plus wedding day.", min: 120, cents: 35000, from: true }, 1),
      svc({ proId: P10, cat: "makeup", name: "Group / Party (per face)", desc: "Bridal party glam.", min: 45, cents: 9000, from: true }, 2),
    ],
    portfolio: [
      port(P10, "photo-1596704017254-9b121068fb31", "Bridal glam", 0, { cover: true }),
      port(P10, "photo-1526045478516-99145907023c", "Full glam", 1),
      port(P10, "photo-1526045478516-99145907023c", "Editorial", 2),
    ],
    reviews: [
      rev("Naomi F.", 5, "Amara did my whole bridal party. Every single face was stunning.", "Bridal Trial + Day", "The honor was mine, Naomi 🤍"),
      rev("Grace O.", 5, "Long-wear is no joke — 12 hours, still flawless.", "Signature Glam"),
    ],
  }),
  // ---- #11: inactive (onboarding incomplete). MUST NOT appear publicly. ----
  pro({
    userId: P11,
    slug: "kai-style-co",
    businessName: "Kai Style Co",
    displayName: "Kai M.",
    headline: "Personal styling (setting up)",
    primarySpecialty: "Personal styling",
    city: "Venice",
    postalCode: "90291",
    lat: 33.985,
    lng: -118.4695,
    locationType: "mobile",
    isActive: false, // onboarding incomplete
    isVerified: false,
    ratingAverage: 0,
    reviewCount: 0,
    jobsCompleted: 0,
    instagramHandle: "kaistyleco",
    igFollowerCount: "800",
    bio: "Profile in progress.",
    services: [svc({ proId: P11, cat: "stylist", name: "Styling Session", desc: "Draft.", min: 90, cents: 10000, loc: "mobile" }, 0)],
    portfolio: [],
    reviews: [],
  }),
  // ---- #12: verified but suspended/unapproved (is_active false). MUST NOT appear. ----
  pro({
    userId: P12,
    slug: "gigi-glam",
    businessName: "Gigi Glam",
    displayName: "Gigi R.",
    headline: "Glam & lashes (under review)",
    primarySpecialty: "Glam",
    specialties: ["Glam", "Lashes"],
    city: "Downtown LA",
    postalCode: "90013",
    lat: 34.043,
    lng: -118.2673,
    locationType: "both",
    isActive: false, // suspended / not approved
    isVerified: true,
    ratingAverage: 4.2,
    reviewCount: 1,
    jobsCompleted: 40,
    instagramHandle: "gigiglam",
    igFollowerCount: "5.0k",
    bio: "Account under review.",
    services: [svc({ proId: P12, cat: "makeup", name: "Glam", desc: "Full glam.", min: 60, cents: 9000 }, 0)],
    portfolio: [port(P12, "photo-1522335789203-aabd1fc54bc9", "Glam", 0)],
    reviews: [rev("Anon", 4, "Nice work.", "Glam")],
  }),
];

export const PRO_IDS = { P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12 };

// Default viewer location for local/dev distance calc (Downtown LA).
export const DEFAULT_VIEWER = { lat: 34.0407, lng: -118.2468 };
