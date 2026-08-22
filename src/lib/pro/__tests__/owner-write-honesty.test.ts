import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 0037 makes owner writes to professional_profiles active-only at RLS. A
// suspended/banned owner's UPDATE is therefore filtered to ZERO rows and
// PostgREST returns NO error — so any action that assumed "no error means
// saved" showed a fake success. These tests pin the honest shape: every
// owner-session update must .select() and refuse to report success on zero
// rows. Source-level assertions because "use server" modules can't be
// imported into a plain unit test without a full Supabase/Next request scope.
const ROOT = join(__dirname, "../../../..");
const FILES = ["src/lib/pro/actions.ts", "src/lib/pro/compliance-actions.ts"] as const;
const SUSPENSION_COPY = "this account may be suspended";

describe("owner writes to professional_profiles never fake success", () => {
  it("every owner-session update selects rows and guards the zero-row case", () => {
    let checked = 0;
    for (const rel of FILES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const parts = src.split('.from("professional_profiles")');
      // parts[0] is the text before the first occurrence; each later part is the
      // code that follows one occurrence.
      expect(parts.length).toBeGreaterThan(1);
      for (let i = 1; i < parts.length; i++) {
        const before = parts[i - 1].slice(-80);
        const after = parts[i];
        const isUpdate = /^\s*\n?\s*\.update\(/.test(after);
        if (!isUpdate) continue;
        // Service-role writes (platform-only columns) legitimately bypass RLS.
        if (/\badmin\s*$/.test(before.trimEnd()) || /\badmin\s*\n?\s*$/.test(before)) continue;
        // Window big enough to span the largest update payload (saveProfileAction)
        // plus its guard, small enough not to leak into the next action.
        const stmt = after.slice(0, 2000);
        expect(stmt, `${rel}: owner update must .select() to detect RLS-filtered zero rows`).toMatch(/\.select\(/);
        expect(stmt, `${rel}: owner update must guard the zero-row case`).toMatch(/!\w+\?\.length/);
        expect(stmt, `${rel}: zero-row guard must return honest suspension copy`).toContain(SUSPENSION_COPY);
        checked++;
      }
    }
    // Non-vacuity: if the detection above stops matching (renamed table access,
    // refactored query builder) this test must fail loudly, not pass empty.
    expect(checked, "expected 3 guarded owner updates (profile, availability settings, service locations)").toBe(3);
  });

  it("saveAvailabilityAction distinguishes a real DB error from the zero-row case", () => {
    const src = readFileSync(join(ROOT, "src/lib/pro/actions.ts"), "utf8");
    // Discarding `error` would blame suspension for genuine write failures.
    expect(src).toMatch(/data: settingsRows, error: settingsError/);
    expect(src).toMatch(/if \(settingsError\) return \{ error: settingsError\.message \}/);
  });

  it("the zero-row guard runs before any success is returned", () => {
    const src = readFileSync(join(ROOT, "src/lib/pro/actions.ts"), "utf8");
    for (const action of ["saveAvailabilityAction", "saveProfileAction"]) {
      const body = src.slice(src.indexOf(`export async function ${action}`));
      const guard = body.indexOf("?.length");
      const success = body.indexOf("success:");
      expect(guard, `${action}: expected a zero-row guard`).toBeGreaterThan(-1);
      expect(success, `${action}: expected a success return`).toBeGreaterThan(-1);
      expect(guard, `${action}: guard must precede the success return`).toBeLessThan(success);
    }
  });

  it("saveAvailabilityAction refuses before it deletes the pro's existing rules", () => {
    // The settings update is the RLS canary: if it wrote zero rows the account
    // can't write, so we must bail BEFORE the destructive delete of
    // availability_rules — otherwise a suspended pro loses their schedule.
    const src = readFileSync(join(ROOT, "src/lib/pro/actions.ts"), "utf8");
    const body = src.slice(src.indexOf("export async function saveAvailabilityAction"));
    const guard = body.indexOf("!settingsRows?.length");
    const del = body.indexOf('.from("availability_rules")');
    expect(guard).toBeGreaterThan(-1);
    expect(del).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(del);
  });
});
