// Search autocomplete + suggestions. Pure → unit-tested. Given a partial query
// and the marketplace corpus, returns ranked completions (names, services,
// categories, cities) plus curated popular searches. Typo-tolerant via a small
// edit-distance fallback.

export interface SuggestCorpusItem {
  slug: string;
  displayName: string;
  city: string;
  specialties: string[];
  serviceNames: string[];
  categories: string[];
}

export interface Suggestion {
  label: string;
  kind: "professional" | "service" | "category" | "city" | "specialty";
  slug?: string;
}

export const POPULAR_SEARCHES = ["Bridal makeup", "Silk press", "Knotless braids", "Volume lashes", "Luxury manicure", "Soft glam", "Wig install"];

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, "").trim();

/** Levenshtein distance capped for cheap typo tolerance. */
export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(dp[i] + 1, dp[i - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[a.length];
}

export function suggest(query: string, corpus: SuggestCorpusItem[], limit = 8): Suggestion[] {
  const q = norm(query);
  if (!q) return [];
  const seen = new Set<string>();
  const out: Array<Suggestion & { rank: number }> = [];

  const consider = (label: string, kind: Suggestion["kind"], slug?: string) => {
    const key = `${kind}:${label.toLowerCase()}`;
    if (seen.has(key)) return;
    const n = norm(label);
    let rank = -1;
    if (n.startsWith(q)) rank = 0;
    else if (n.includes(q)) rank = 1;
    else if (q.length >= 4) {
      // Typo tolerance: 1 edit for short queries, up to 2 (transpositions) for longer.
      const budget = q.length >= 6 ? 2 : 1;
      if (editDistance(n.slice(0, q.length + 2), q) <= budget) rank = 2;
    }
    if (rank < 0) return;
    seen.add(key);
    out.push({ label, kind, slug, rank });
  };

  for (const item of corpus) {
    consider(item.displayName, "professional", item.slug);
    for (const s of item.serviceNames) consider(s, "service");
    for (const s of item.specialties) consider(s, "specialty");
    consider(item.city, "city");
    for (const c of item.categories) consider(c, "category");
  }

  return out
    .sort((a, b) => a.rank - b.rank || a.label.length - b.label.length)
    .slice(0, limit)
    .map(({ label, kind, slug }) => ({ label, kind, slug }));
}
