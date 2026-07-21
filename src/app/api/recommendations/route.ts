import { NextResponse } from "next/server";
import { getShelf } from "@/lib/recommend/data";
import { SHELF_META, type ShelfKey } from "@/lib/recommend/shelves";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const VALID: ShelfKey[] = ["recommended", "trending", "top_rated", "new", "available_today", "luxury"];

// GET /api/recommendations?shelf=trending&limit=8
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit("search", ip, Date.now()).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = new URL(req.url);
  const shelf = (url.searchParams.get("shelf") ?? "recommended") as ShelfKey;
  if (!VALID.includes(shelf)) {
    return NextResponse.json({ error: "Unknown shelf", valid: VALID }, { status: 400 });
  }
  const limit = Math.min(24, Math.max(1, Number(url.searchParams.get("limit") ?? 8) || 8));

  const pros = await getShelf(shelf, limit);
  return NextResponse.json({
    shelf,
    title: SHELF_META[shelf],
    count: pros.length,
    results: pros.map((p) => ({
      slug: p.slug,
      name: p.displayName,
      specialty: p.primarySpecialty,
      rating: p.ratingAverage,
      reviews: p.reviewCount,
      startingPriceCents: p.startingPriceCents,
      distanceMi: p.distanceMi != null ? Math.round(p.distanceMi * 10) / 10 : null,
      verified: p.isVerified,
      categories: p.categories,
    })),
  });
}
