// Recent searches, persisted locally. Small, dependency-free.
const KEY = "iglamher:recent-searches";
const MAX = 6;

export function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): void {
  const t = term.trim();
  if (!t) return;
  try {
    const prev = getRecentSearches().filter((x) => x.toLowerCase() !== t.toLowerCase());
    localStorage.setItem(KEY, JSON.stringify([t, ...prev].slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// Curated suggestions shown before the user has typed.
export const SEARCH_SUGGESTIONS = [
  "Bridal makeup",
  "Silk press",
  "Knotless braids",
  "Volume lashes",
  "Luxury manicure",
  "Soft glam",
  "Wig install",
];
