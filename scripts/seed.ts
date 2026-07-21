/**
 * Dev seed — creates test auth accounts AND the 12-professional marketplace.
 *
 * Auth users must be created via the Auth admin API (not seed.sql), so this
 * script owns everything that depends on auth.users. It sources professionals
 * from src/lib/data/seed.ts so the seeded DB matches the local fallback exactly.
 *
 * Run AFTER migrations 0001–0004 and supabase/seed.sql (categories) are applied:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
 *
 * Idempotent: re-running updates the same rows by email / id.
 */
import { createClient } from "@supabase/supabase-js";
import { PROFESSIONALS, CATEGORY_IDS } from "../src/lib/data/seed";
import type { Professional } from "../src/lib/data/model";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || url.includes("placeholder")) {
  console.error("Set real NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const PASSWORD = "Passw0rd!test";

const TEST_ACCOUNTS = [
  { email: "customer@iglamher.test", fullName: "Cara Customer", role: "customer" as const },
  { email: "pro@iglamher.test", fullName: "Priya Pro", role: "professional" as const },
  { email: "admin@iglamher.test", fullName: "Ada Admin", role: "admin" as const },
];

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser(email: string, fullName: string): Promise<string> {
  const existing = await findUserByEmail(email);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user.id;
}

async function seedTestAccounts() {
  for (const a of TEST_ACCOUNTS) {
    const id = await ensureUser(a.email, a.fullName);
    await admin.from("profiles").update({ role: a.role, full_name: a.fullName }).eq("id", id);
    if (a.role === "admin") {
      await admin.from("admin_roles").upsert({ user_id: id, kind: "admin" }, { onConflict: "user_id" });
    }
    console.log(`test account ${a.email} (${a.role})`);
  }
}

async function seedProfessional(p: Professional) {
  const email = `${p.slug}@pro.iglamher.test`;
  const id = await ensureUser(email, p.displayName);

  await admin.from("profiles").update({ role: "professional", full_name: p.displayName }).eq("id", id);

  await admin.from("professional_profiles").upsert(
    {
      user_id: id,
      slug: p.slug,
      business_name: p.businessName,
      avatar_url: p.avatarUrl,
      cover_url: p.coverUrl,
      headline: p.headline,
      bio: p.bio,
      primary_specialty: p.primarySpecialty,
      specialties: p.specialties,
      languages: p.languages,
      years_experience: p.yearsExperience,
      city: p.city,
      postal_code: p.postalCode,
      location_type: p.locationType,
      service_radius_miles: p.serviceRadiusMiles,
      location_lat: p.lat,
      location_lng: p.lng,
      timezone: p.timezone,
      is_active: p.isActive,
      is_verified: p.isVerified,
      is_featured: p.isFeatured,
      instant_book: p.instantBook,
      rating_average: p.ratingAverage,
      review_count: p.reviewCount,
      jobs_completed: p.jobsCompleted,
      reliability_score: p.reliabilityScore,
      instagram_handle: p.instagramHandle,
      ig_follower_count: p.igFollowerCount,
      cancellation_policy: p.cancellationPolicy,
      onboarding_complete: p.isActive,
      starting_price_cents: Math.min(...p.services.filter((s) => !s.isArchived).map((s) => s.priceCents), 999999),
    },
    { onConflict: "user_id" },
  );

  // Replace child rows for idempotency.
  await admin.from("services").delete().eq("professional_id", id);
  if (p.services.length) {
    await admin.from("services").insert(
      p.services.map((s) => ({
        id: s.id,
        professional_id: id,
        category_id: CATEGORY_IDS[s.categorySlug],
        name: s.name,
        description: s.description,
        duration_minutes: s.durationMin,
        price_cents: s.priceCents,
        price_is_from: s.priceIsFrom,
        deposit_type: s.depositType,
        deposit_value: s.depositValue,
        location_type: s.locationType,
        buffer_before_minutes: s.bufferBeforeMin,
        buffer_after_minutes: s.bufferAfterMin,
        travel_fee_cents: s.travelFeeCents,
        instant_book: s.instantBook,
        is_active: s.isActive,
        deleted_at: s.isArchived ? new Date("2026-01-01T00:00:00Z").toISOString() : null,
        sort_order: s.sortOrder,
      })),
    );
  }

  await admin.from("service_addons").delete().eq("professional_id", id);
  if (p.addons.length) {
    await admin.from("service_addons").insert(
      p.addons.map((a) => ({ id: a.id, professional_id: id, name: a.name, price_cents: a.priceCents, is_active: a.isActive })),
    );
  }

  await admin.from("professional_portfolio_items").delete().eq("professional_id", id);
  if (p.portfolio.length) {
    await admin.from("professional_portfolio_items").insert(
      p.portfolio.map((it) => ({
        id: it.id,
        professional_id: id,
        kind: it.kind,
        url: it.url ?? null,
        thumb_url: it.thumbUrl ?? null,
        caption: it.caption ?? null,
        is_cover: it.isCover,
        is_hidden: it.isHidden,
        sort_order: it.sortOrder,
      })),
    );
  }

  await admin.from("availability_rules").delete().eq("professional_id", id);
  if (p.availability.length) {
    await admin.from("availability_rules").insert(
      p.availability.map((r) => ({
        professional_id: id,
        weekday: r.weekday,
        start_minute: r.startMinute,
        end_minute: r.endMinute,
      })),
    );
  }

  console.log(`professional ${p.slug} — active=${p.isActive} verified=${p.isVerified} featured=${p.isFeatured}`);
}

async function main() {
  await seedTestAccounts();
  for (const p of PROFESSIONALS) await seedProfessional(p);
  console.log(`\nDone. ${PROFESSIONALS.length} professionals seeded. All logins use password: ${PASSWORD}`);
  console.log("Note: reviews are not seeded (they require completed bookings — Phase 4).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
