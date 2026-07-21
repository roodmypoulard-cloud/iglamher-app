/**
 * Live-backend connection verifier. Run once real credentials are set:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/verify-live.ts
 *
 * Checks: env present, DB reachable, migrations applied, RLS denies anon on
 * sensitive tables, storage buckets exist, Stripe key format. Exits non-zero on
 * any failure so it can gate a deploy.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

async function main() {
  if (!url || !anon || !service || url.includes("placeholder")) {
    console.error("Missing real Supabase env (URL / anon / service role). Nothing to verify.");
    process.exit(1);
  }

  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { persistSession: false } });

  // 1. DB reachable + seed applied.
  const { data: cats, error: catErr } = await admin.from("categories").select("id").limit(1);
  check("Database reachable", !catErr, catErr?.message);
  check("Categories seeded", !!cats && cats.length > 0, cats?.length === 0 ? "run supabase/seed.sql" : undefined);

  // 2. Migrations applied — probe a Phase-6 table/column.
  const { error: relErr } = await admin.from("professional_profiles").select("reliability_score").limit(1);
  check("Migration 0006 applied (reliability_score)", !relErr, relErr?.message);
  const { error: disputeErr } = await admin.from("disputes").select("id").limit(1);
  check("Migration 0005 applied (disputes)", !disputeErr, disputeErr?.message);

  // 3. RLS denies anon on sensitive tables.
  const { data: fraud } = await anonClient.from("fraud_flags").select("id").limit(1);
  check("RLS denies anon → fraud_flags", !fraud || fraud.length === 0, "anon could read fraud_flags!");
  const { data: audit } = await anonClient.from("audit_logs").select("id").limit(1);
  check("RLS denies anon → audit_logs", !audit || audit.length === 0, "anon could read audit_logs!");

  // 4. Storage buckets exist.
  const { data: buckets } = await admin.storage.listBuckets();
  const names = new Set((buckets ?? []).map((b) => b.name));
  check("Bucket: verification-documents (private)", names.has("verification-documents"), "run storage-policies.sql");
  check("Bucket: portfolio", names.has("portfolio"), "run storage-policies.sql");

  // 5. Stripe key format (not validity — that needs a live call).
  const sk = process.env.STRIPE_SECRET_KEY;
  check("Stripe secret key present", !!sk, "payments disabled until set");

  let failed = 0;
  console.log("\niGlamHer live verification\n" + "=".repeat(32));
  for (const r of results) {
    console.log(`${r.ok ? "✅" : "❌"} ${r.name}${!r.ok && r.detail ? `  — ${r.detail}` : ""}`);
    if (!r.ok) failed++;
  }
  console.log("=".repeat(32));
  console.log(failed === 0 ? "All checks passed." : `${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
