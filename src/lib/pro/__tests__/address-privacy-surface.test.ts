import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * C3 leak 1 — the exact address must not be reachable through the publicly-readable
 * `professional_profiles` table.
 *
 * The original fix redacted `studio_address` in `mapPro()`, which only protects the
 * Next.js render path: `0003_rls.sql`'s "pro public read" policy is row-level, so a
 * client calling PostgREST directly could still ask for the column. Migration 0034
 * removes the column from that table entirely and moves it to
 * `professional_private_locations` under its own RLS.
 *
 * These are static-surface assertions, not a live-DB integration test — there is no
 * database in CI. They fail the moment someone reintroduces a public read path,
 * which is the regression that actually matters.
 */

const ROOT = join(__dirname, "../../../..");
const SRC = join(ROOT, "src");
const MIGRATIONS = join(ROOT, "supabase/migrations");

const migration0034 = readFileSync(join(MIGRATIONS, "0034_private_location_split.sql"), "utf8");

/** Every .ts/.tsx file under src/, recursively. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const FILES = sourceFiles(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("C3 — the address is not reachable via the public table", () => {
  it("0034 drops studio_address from professional_profiles", () => {
    expect(migration0034).toMatch(
      /alter table public\.professional_profiles\s+drop column if exists studio_address/i,
    );
  });

  it("0034 preserves the data by backfilling the private table first", () => {
    const backfillAt = migration0034.indexOf("insert into public.professional_private_locations");
    const dropAt = migration0034.search(/drop column if exists studio_address/i);
    expect(backfillAt).toBeGreaterThan(-1);
    expect(dropAt).toBeGreaterThan(-1);
    // Data must be copied out BEFORE the column is destroyed.
    expect(backfillAt).toBeLessThan(dropAt);
  });

  it("the private table has RLS enabled", () => {
    expect(migration0034).toMatch(
      /alter table public\.professional_private_locations enable row level security/i,
    );
  });

  it("only the owner, an admin, or a committed booking party may read it", () => {
    expect(migration0034).toMatch(/auth\.uid\(\) = user_id or public\.is_admin\(auth\.uid\(\)\)/);
    // The customer policy must require a real booking against THIS pro...
    expect(migration0034).toMatch(/b\.professional_id = professional_private_locations\.user_id/);
    expect(migration0034).toMatch(/b\.customer_id = auth\.uid\(\)/);
    // ...at a committed status. pending_payment must never unlock the address.
    expect(migration0034).toMatch(/b\.status in \('confirmed', 'in_progress', 'completed'\)/);
    expect(migration0034).not.toMatch(/b\.status in \([^)]*pending_payment/);
  });

  it("public coordinates are coarsened for pros who hide their pin", () => {
    expect(migration0034).toMatch(/create or replace function public\.coarsen_coord/i);
    expect(migration0034).toMatch(/round\(v::numeric, 2\)/);
    // Backfill of existing rows...
    expect(migration0034).toMatch(/set location_lat = public\.coarsen_coord\(location_lat\)/i);
    // ...and a trigger so future writes can't quietly restore exact coords.
    expect(migration0034).toMatch(/before insert or update on public\.professional_profiles/i);
    expect(migration0034).toMatch(/coarsen_public_pro_coords/);
  });

  it("the second copy of the secret (geo) is coarsened too", () => {
    expect(migration0034).toMatch(/set geo = st_setsrid/i);
  });

  // Every `.from("<table>").select("<cols>")` pair in the codebase.
  const selects = FILES.filter(({ path }) => !path.includes("__tests__")).flatMap(({ path, text }) =>
    [...text.matchAll(/from\(\s*["'](\w+)["']\s*\)\s*\n?\s*\.select\(\s*["']([^"']*)["']/g)].map((m) => ({
      path: path.replace(ROOT, ""), table: m[1], columns: m[2],
    })),
  );

  it("no query selects studio_address from professional_profiles", () => {
    // The column no longer exists there; such a query would also just error.
    const offenders = selects.filter(
      (s) => s.table === "professional_profiles" && s.columns.includes("studio_address"),
    );
    expect(offenders).toEqual([]);
  });

  it("studio_address is only ever selected from the private table", () => {
    const reads = selects.filter((s) => s.columns.includes("studio_address"));
    expect(reads.length).toBeGreaterThan(0); // the booking + admin readers exist
    for (const r of reads) {
      expect(r.table, `${r.path} selects studio_address from ${r.table}`)
        .toBe("professional_private_locations");
    }
  });

  it("the public marketplace select never names the private table", () => {
    const publicData = readFileSync(join(SRC, "lib/data/professionals.ts"), "utf8");
    expect(publicData).not.toMatch(/from\(\s*["']professional_private_locations["']/);
  });

  it("the Professional domain type carries no street address", () => {
    const model = readFileSync(join(SRC, "lib/data/model.ts"), "utf8");
    const iface = model.slice(model.indexOf("export interface Professional {"));
    const body = iface.slice(0, iface.indexOf("\n}"));
    expect(body).not.toMatch(/studioAddress|addressLine1|streetAddress/);
    // It does carry the privacy flag, which the UI needs.
    expect(body).toMatch(/hideExactPin: boolean/);
  });

  it("customer-facing distance goes through the privacy-aware formatter", () => {
    const offenders = FILES.filter(({ path, text }) =>
      path.includes("/components/") &&
      /\bformatDistance\(/.test(text) &&
      !/formatDistanceFor\(/.test(text),
    ).map(({ path }) => path.replace(ROOT, ""));
    expect(offenders).toEqual([]);
  });
});
