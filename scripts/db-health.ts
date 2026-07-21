/**
 * Database health check. Run against any environment after migrations:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:health
 *
 * Verifies connectivity, that every critical table (through migration 0009)
 * exists, that RLS denies anon on sensitive tables, and reports row counts.
 * Exits non-zero on any failure so it can gate a deploy.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !service || url.includes("placeholder")) {
  console.error("Set real NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, service, { auth: { persistSession: false } });
const anonClient = anon ? createClient(url, anon, { auth: { persistSession: false } }) : null;

const CRITICAL_TABLES = [
  "profiles", "professional_profiles", "services", "categories", "bookings", "booking_line_items",
  "payments", "refunds", "payout_records", "reviews", "conversations", "messages", "notifications",
  "favorites", "recently_viewed", "disputes", "professional_verifications", "audit_logs",
  // Phase 7–9:
  "loyalty_accounts", "referrals", "campaigns", "analytics_events", "account_credits",
  "stripe_events", "platform_settings", "earnings_ledger", "beta_access_codes",
];
const SENSITIVE = ["fraud_flags", "audit_logs", "stripe_events"];

async function main() {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const check = (name: string, ok: boolean, detail?: string) => results.push({ name, ok, detail });

  const { error: ping } = await admin.from("categories").select("id").limit(1);
  check("Connectivity", !ping, ping?.message);

  for (const t of CRITICAL_TABLES) {
    const { error, count } = await admin.from(t).select("*", { count: "exact", head: true });
    check(`table ${t}`, !error, error ? error.message : `${count ?? 0} rows`);
  }

  if (anonClient) {
    for (const t of SENSITIVE) {
      const { data } = await anonClient.from(t).select("*").limit(1);
      check(`RLS deny anon → ${t}`, !data || data.length === 0, "anon could read!");
    }
  }

  let failed = 0;
  console.log("\niGlamHer DB health\n" + "=".repeat(40));
  for (const r of results) {
    console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
    if (!r.ok) failed++;
  }
  console.log("=".repeat(40));
  console.log(failed === 0 ? "Healthy." : `${failed} check(s) failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
