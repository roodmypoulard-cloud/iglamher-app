import { NextResponse } from "next/server";
import { searchProfessionalViews } from "@/lib/data/professionals";
import { publicServices } from "@/lib/marketplace/visibility";
import { suggest, POPULAR_SEARCHES, type SuggestCorpusItem } from "@/lib/search/suggest";
import { appCache, getOrSet } from "@/lib/cache";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/search/suggest?q=sil — autocomplete + popular searches.
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit("search", ip, Date.now()).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ query: "", suggestions: [], popular: POPULAR_SEARCHES });

  // Corpus is cached for 60s — it changes slowly and every keystroke hits this.
  const corpus = await getOrSet(appCache, "suggest:corpus", 60_000, async (): Promise<SuggestCorpusItem[]> => {
    const pros = await searchProfessionalViews({});
    return pros.map((p) => ({
      slug: p.slug,
      displayName: p.displayName,
      city: p.city,
      specialties: p.specialties,
      serviceNames: publicServices(p).map((s) => s.name),
      categories: p.categories,
    }));
  });

  return NextResponse.json(
    { query: q, suggestions: suggest(q, corpus, 8), popular: POPULAR_SEARCHES },
    { headers: { "Cache-Control": "private, max-age=15" } },
  );
}
