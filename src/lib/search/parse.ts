// Natural-language query parser (pure — no vendor). Extracts structured filters
// from queries like "natural glam under $150 tomorrow" so search understands
// intent. Upgrades to embeddings when OPENAI_API_KEY is set (see integrations/search).
import type { CategorySlug } from "@/lib/data/model";

export interface ParsedQuery {
  text: string;
  category?: CategorySlug;
  maxPriceCents?: number;
  when?: "today" | "tomorrow" | "weekend";
}

const CATEGORY_WORDS: Array<[RegExp, CategorySlug]> = [
  [/\b(makeup|glam|mua|bridal|beat|foundation)\b/, "makeup"],
  [/\b(hair|silk press|silk|braids|braid|cut|blowout|install|wig|cornrow|twist)\b/, "hair"],
  [/\b(lash|lashes|volume set|hybrid set|lash lift)\b/, "lashes"],
  [/\b(nail|nails|manicure|mani|pedicure|pedi|gel|acrylic|gel-x|overlay|nail art)\b/, "nails"],
  [/\b(stylist|styling|wardrobe|closet|outfit)\b/, "stylist"],
];

export function parseNaturalQuery(text: string): ParsedQuery {
  const lower = text.toLowerCase();
  const out: ParsedQuery = { text };

  const price = lower.match(/(?:under|below|less than|max|<)\s*\$?\s*(\d{2,4})/);
  if (price) out.maxPriceCents = Number(price[1]) * 100;

  for (const [re, cat] of CATEGORY_WORDS) {
    if (re.test(lower)) {
      out.category = cat;
      break;
    }
  }

  if (/\btomorrow\b/.test(lower)) out.when = "tomorrow";
  else if (/\b(today|tonight)\b/.test(lower)) out.when = "today";
  else if (/\bweekend\b/.test(lower)) out.when = "weekend";

  return out;
}
