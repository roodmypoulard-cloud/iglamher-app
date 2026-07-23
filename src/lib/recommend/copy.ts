// Display labels for category slugs on the Recommended page.
import type { CategorySlug } from "@/lib/data/model";

const LABELS: Record<string, string> = {
  hair: "Hair",
  makeup: "Makeup",
  lashes: "Lash",
  nails: "Nail",
  stylist: "Wardrobe styling",
};

export function categoryLabelForSlug(slug: CategorySlug | string): string {
  return LABELS[slug] ?? String(slug);
}
