/**
 * One-off, idempotent, ADDITIVE live update to introduce the Nails category.
 *  • Upserts the `nails` category (sort_order 4) and bumps `stylist` to 5.
 *  • Adds nail services to two existing pros (maya-rose-beauty, bella-lash-lab).
 * Only ever deletes NAIL services before re-inserting — never touches existing
 * hair/makeup/lash services, so no booking foreign keys are affected.
 *
 * Run: set env then `npx tsx scripts/add-nails.ts`
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { CATEGORY_IDS } from "../src/lib/data/seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || url.includes("placeholder")) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const NAILS_ID = CATEGORY_IDS.nails;

type NailSvc = {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number;
  location_type: "mobile" | "in_salon" | "both";
  instant_book: boolean;
  sort_order: number;
};

const NAILS_BY_SLUG: Record<string, NailSvc[]> = {
  "maya-rose-beauty": [
    { name: "Luxury Manicure", description: "Clean, glossy nude finish with cuticle care.", duration_minutes: 60, price_cents: 6500, location_type: "both", instant_book: true, sort_order: 10 },
    { name: "Gel Manicure", description: "Long-wear gel in a refined, editorial shade.", duration_minutes: 75, price_cents: 8000, location_type: "both", instant_book: false, sort_order: 11 },
  ],
  "lux-lash-bar": [
    { name: "Structured Gel Overlay", description: "Strengthening overlay, natural shape.", duration_minutes: 90, price_cents: 9500, location_type: "both", instant_book: false, sort_order: 10 },
    { name: "Luxury Manicure", description: "Glossy, clean, editorial finish.", duration_minutes: 60, price_cents: 6500, location_type: "both", instant_book: true, sort_order: 11 },
  ],
  "amara-beauty": [
    { name: "Luxury Manicure", description: "Clean, glossy nude finish with cuticle care.", duration_minutes: 60, price_cents: 7000, location_type: "both", instant_book: true, sort_order: 10 },
    { name: "Gel Manicure", description: "Long-wear gel in a refined, editorial shade.", duration_minutes: 75, price_cents: 8500, location_type: "both", instant_book: false, sort_order: 11 },
  ],
};

async function main() {
  // 1) Category: upsert nails, bump stylist.
  const { error: catErr } = await admin.from("categories").upsert(
    {
      id: NAILS_ID,
      slug: "nails",
      name: "Nails",
      description: "Luxury manicures, gel, structured overlays & nail art",
      image_url: "/brand/categories/nails.jpg",
      is_active: true,
      sort_order: 4,
    },
    { onConflict: "id" },
  );
  if (catErr) throw catErr;
  const { error: stylErr } = await admin.from("categories").update({ sort_order: 5 }).eq("slug", "stylist");
  if (stylErr) throw stylErr;
  console.log("✓ nails category upserted; stylist → sort_order 5");

  // 2) Nail services for the two pros (idempotent: clear existing nail svcs first).
  for (const [slug, svcs] of Object.entries(NAILS_BY_SLUG)) {
    const { data: pro, error: proErr } = await admin
      .from("professional_profiles")
      .select("user_id")
      .eq("slug", slug)
      .maybeSingle();
    if (proErr) throw proErr;
    if (!pro) {
      console.warn(`! provider ${slug} not found on live — skipping`);
      continue;
    }
    const proId = (pro as { user_id: string }).user_id;

    await admin.from("services").delete().eq("professional_id", proId).eq("category_id", NAILS_ID);

    const rows = svcs.map((s) => ({
      id: randomUUID(),
      professional_id: proId,
      category_id: NAILS_ID,
      name: s.name,
      description: s.description,
      duration_minutes: s.duration_minutes,
      price_cents: s.price_cents,
      price_is_from: false,
      deposit_type: "percent",
      deposit_value: 20,
      location_type: s.location_type,
      buffer_before_minutes: 0,
      buffer_after_minutes: 15,
      travel_fee_cents: null,
      instant_book: s.instant_book,
      is_active: true,
      deleted_at: null,
      sort_order: s.sort_order,
    }));
    const { error: svcErr } = await admin.from("services").insert(rows);
    if (svcErr) throw svcErr;

    // Keep the denormalized starting price correct.
    const { data: active } = await admin
      .from("services")
      .select("price_cents")
      .eq("professional_id", proId)
      .eq("is_active", true)
      .is("deleted_at", null);
    const min = Math.min(...(active as { price_cents: number }[]).map((r) => r.price_cents));
    await admin.from("professional_profiles").update({ starting_price_cents: min }).eq("user_id", proId);

    console.log(`✓ ${slug}: ${rows.length} nail services added, starting_price → ${min}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
