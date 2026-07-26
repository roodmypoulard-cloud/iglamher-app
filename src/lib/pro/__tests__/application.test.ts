import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isValidHandle, isValidUrl, normalizeUrl, normalizeHandle, hasAtLeastOneLink,
  validateForSubmit, magicBytesMatch, missingAgreementKeys, currentAgreementAcceptances,
  sectionEditable, APPLICATION_SECTIONS,
} from "../application";
import {
  PRO_AGREEMENTS, PRO_AGREEMENT_KEYS, REQUIRED_HOME_STUDIO_KEYS,
  type LocationCompliance,
} from "../compliance";

/** Every required home-studio question answered "yes" — the clean-pass case. */
const ALL_REQUIRED_YES: LocationCompliance = Object.fromEntries(
  REQUIRED_HOME_STUDIO_KEYS.map((k) => [k, "yes"]),
);

describe("social/url validators", () => {
  it("accepts valid handles, rejects junk", () => {
    expect(isValidHandle("glam.pro")).toBe(true);
    expect(isValidHandle("@glam_pro")).toBe(true);
    expect(isValidHandle("has space")).toBe(false);
    expect(isValidHandle("way_too_long_handle_that_exceeds_limit_x")).toBe(false);
  });
  it("normalizes handles (strips @, lowercases)", () => {
    expect(normalizeHandle("@GlamPro")).toBe("glampro");
  });
  it("validates + normalizes urls", () => {
    expect(isValidUrl("iglamher.com")).toBe(true);
    expect(isValidUrl("https://iglamher.com/x")).toBe(true);
    expect(isValidUrl("notaurl")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(normalizeUrl("iglamher.com")).toBe("https://iglamher.com");
  });
  it("requires at least one link", () => {
    expect(hasAtLeastOneLink({})).toBe(false);
    expect(hasAtLeastOneLink({ instagramHandle: "x" })).toBe(true);
    expect(hasAtLeastOneLink({ portfolioUrl: "https://x.com" })).toBe(true);
  });
});

describe("validateForSubmit", () => {
  const complete = {
    primarySpecialty: "makeup", city: "LA", yearsExperience: 3, school: "Empire Beauty School",
    bio: "Bridal and editorial makeup artist with a soft glam signature style.",
    instagramHandle: "glampro", portfolioCount: 4, hasIdDocument: true, hasCredentialDocument: true,
    serviceLocations: ["salon_suite"], acceptedAgreements: currentAgreementAcceptances(),
  };
  it("passes a complete application", () => {
    expect(validateForSubmit(complete)).toEqual([]);
  });
  it("flags missing category, city, bio, id, credential, and links", () => {
    const e = validateForSubmit({ portfolioCount: 0, hasIdDocument: false, hasCredentialDocument: false });
    expect(e.length).toBeGreaterThan(3);
    expect(e.join(" ")).toMatch(/category/i);
    expect(e.join(" ")).toMatch(/ID/);
    expect(e.join(" ")).toMatch(/certification|license|diploma|certificate/i);
  });
  it("requires at least one credential document even when everything else is complete", () => {
    expect(validateForSubmit({ ...complete, hasCredentialDocument: false }))
      .toEqual(["Upload at least one certification, license, diploma, or certificate."]);
  });
  it("requires 3+ photos OR a portfolio link", () => {
    expect(validateForSubmit({ ...complete, portfolioCount: 1, portfolioUrl: undefined }).some((x) => /portfolio/i.test(x))).toBe(true);
    expect(validateForSubmit({ ...complete, portfolioCount: 0, portfolioUrl: "https://folio.com" })).toEqual([]);
  });
  it("rejects a too-short bio", () => {
    expect(validateForSubmit({ ...complete, bio: "hi" }).some((x) => /bio/i.test(x))).toBe(true);
  });

  // ---- C1: legal prerequisites are hard submit gates ----
  describe("C1 — legal gates", () => {
    it("blocks submit with no service location declared", () => {
      expect(validateForSubmit({ ...complete, serviceLocations: [] }))
        .toEqual(["Choose where you provide services."]);
      expect(validateForSubmit({ ...complete, serviceLocations: undefined }))
        .toEqual(["Choose where you provide services."]);
    });

    it("blocks submit when the professional agreements aren't accepted", () => {
      expect(validateForSubmit({ ...complete, acceptedAgreements: [] }))
        .toEqual(["Accept both professional agreements before submitting."]);
    });

    it("blocks submit when only ONE agreement is accepted", () => {
      const onlyFirst = currentAgreementAcceptances().slice(0, 1);
      expect(onlyFirst).toHaveLength(1);
      expect(validateForSubmit({ ...complete, acceptedAgreements: onlyFirst }))
        .toEqual(["Accept both professional agreements before submitting."]);
    });

    it("rejects an acceptance of a superseded agreement version", () => {
      const stale = PRO_AGREEMENT_KEYS.map((k) => ({ agreement_key: k, version: "2000-01-01" }));
      expect(validateForSubmit({ ...complete, acceptedAgreements: stale }))
        .toEqual(["Accept both professional agreements before submitting."]);
    });

    it("requires every required home-studio answer when working from home", () => {
      const errors = validateForSubmit({ ...complete, serviceLocations: ["home_studio"], locationCompliance: {} });
      expect(errors.some((e) => /home studio question/i.test(e))).toBe(true);
    });

    it("applies the home-studio gate to 'multiple' locations too", () => {
      const errors = validateForSubmit({ ...complete, serviceLocations: ["multiple"], locationCompliance: {} });
      expect(errors.some((e) => /home studio question/i.test(e))).toBe(true);
    });

    it("passes once every required home-studio question is answered", () => {
      expect(validateForSubmit({
        ...complete, serviceLocations: ["home_studio"], locationCompliance: ALL_REQUIRED_YES,
      })).toEqual([]);
    });

    it("a required 'no' still submits — it flags for review, it does not block", () => {
      const withNo: LocationCompliance = { ...ALL_REQUIRED_YES, [REQUIRED_HOME_STUDIO_KEYS[0]]: "no" };
      expect(validateForSubmit({
        ...complete, serviceLocations: ["home_studio"], locationCompliance: withNo,
      })).toEqual([]);
    });

    it("a partially answered home-studio form still blocks", () => {
      const partial: LocationCompliance = { [REQUIRED_HOME_STUDIO_KEYS[0]]: "yes" };
      expect(validateForSubmit({
        ...complete, serviceLocations: ["home_studio"], locationCompliance: partial,
      }).some((e) => /home studio question/i.test(e))).toBe(true);
    });

    it("does not ask home-studio questions of a salon-only pro", () => {
      expect(validateForSubmit({ ...complete, serviceLocations: ["salon_suite"], locationCompliance: {} }))
        .toEqual([]);
    });
  });
});

describe("missingAgreementKeys", () => {
  it("is empty when both current versions are on file", () => {
    expect(missingAgreementKeys(currentAgreementAcceptances())).toEqual([]);
  });
  it("reports keys accepted only at an older version", () => {
    const stale = [{ agreement_key: PRO_AGREEMENT_KEYS[0], version: "1999-01-01" }];
    expect(missingAgreementKeys(stale)).toEqual(PRO_AGREEMENT_KEYS);
  });
  it("pins acceptances to the exact live version", () => {
    for (const k of PRO_AGREEMENT_KEYS) {
      expect(currentAgreementAcceptances().find((a) => a.agreement_key === k)?.version)
        .toBe(PRO_AGREEMENTS[k].version);
    }
  });
});

describe("magicBytesMatch (anti-spoof)", () => {
  it("accepts real PDF/PNG/JPEG signatures", () => {
    expect(magicBytesMatch("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
    expect(magicBytesMatch("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(magicBytesMatch("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
  });
  it("rejects a file whose bytes don't match the declared type (spoofed)", () => {
    // an .exe / script renamed to .pdf — MZ header, not %PDF
    expect(magicBytesMatch("application/pdf", new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBe(false);
    expect(magicBytesMatch("image/png", new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
  });
});

describe("sectionEditable (application lifecycle)", () => {
  const ALL = APPLICATION_SECTIONS;

  it("draft: every section is editable", () => {
    for (const s of ALL) expect(sectionEditable("draft", [], s)).toBe(true);
  });
  it("rejected: every section is editable (fix + resubmit, 0037)", () => {
    for (const s of ALL) expect(sectionEditable("rejected", [], s)).toBe(true);
  });
  it("needs_more_info: only the admin-flagged sections are editable", () => {
    expect(sectionEditable("needs_more_info", ["portfolio", "identity"], "portfolio")).toBe(true);
    expect(sectionEditable("needs_more_info", ["portfolio", "identity"], "identity")).toBe(true);
    expect(sectionEditable("needs_more_info", ["portfolio", "identity"], "basics")).toBe(false);
    expect(sectionEditable("needs_more_info", [], "basics")).toBe(false);
  });
  it("in-flight and decided-approved applications are fully locked", () => {
    for (const status of ["pending_review", "under_review", "approved"] as const) {
      for (const s of ALL) expect(sectionEditable(status, [...ALL], s)).toBe(false);
    }
  });
});

describe("migration 0037 — rejected applicants can resubmit", () => {
  // Static-surface assertions (no DB in CI), following the 0034 test pattern.
  const ROOT = join(__dirname, "../../../..");
  const sql = readFileSync(join(ROOT, "supabase/migrations/0037_resubmit_after_rejection.sql"), "utf8");

  it("guard whitelists draft, needs_more_info AND rejected -> pending_review, only while active", () => {
    expect(sql).toMatch(/old\.review_status in \('draft', 'needs_more_info', 'rejected'\)/);
    expect(sql).toMatch(/new\.review_status = 'pending_review'/);
    expect(sql).toMatch(/coalesce\(old\.account_status::text, 'active'\) = 'active'/);
    expect(sql).toContain("submit_professional_application");
    expect(sql).toContain("d.created_at > coalesce(v_profile.reviewed_at");
    expect(sql).toContain('drop policy if exists "verif docs owner rw"');
  });

  it("was built from the CURRENT guard baseline — `create or replace` swaps the whole body, so a stale baseline silently drops later guards", () => {
    // Review blocker B2: an earlier draft copied 0025's body, which would have
    // reopened self-award of badges / Recommended placement. These columns come
    // from 0033, 0028 and 0032 respectively and must ALL survive in 0037 —
    // asserted in their EXECUTABLE `new.x is distinct from old.x` form (several
    // names also appear in comments, where toContain would pass vacuously).
    for (const guarded of [
      "identity_verified", "license_verified", "insurance_verified",
      "home_studio_reviewed", "salon_location_verified",
      "is_recommended", "recommended_at", "recommended_until",
      "needs_location_review",
      "account_status", "is_verified", "is_active", "take_rate_bps",
    ]) {
      expect(sql, `0037 must retain the guard clause on ${guarded}`).toMatch(
        new RegExp(String.raw`new\.${guarded}\s+is distinct from old\.${guarded}`),
      );
    }
  });

  it("review metadata is guarded: forgeable only via the submit transition, with canonical values (round-2 M3)", () => {
    // Queue-jump / forgery columns: outside the whitelisted submit transition
    // these must be rejected for non-privileged writers…
    for (const col of ["submitted_at", "resubmission_count", "needs_info_note", "needs_info_sections", "rejection_reason"]) {
      expect(sql, `0037 must guard ${col}`).toMatch(
        new RegExp(String.raw`new\.${col}\s+is distinct from old\.${col}`),
      );
    }
    // …reviewed_at/reviewed_by are NEVER owner-writable (nulling reviewed_at
    // would defeat the fresh-ID recency check on rejected resubmits)…
    expect(sql).toMatch(/new\.reviewed_at\s+is distinct from old\.reviewed_at/);
    expect(sql).toMatch(/new\.reviewed_by\s+is distinct from old\.reviewed_by/);
    // …and during the transition, submitted_at must be ~now (no backdated
    // FIFO queue-jump) and the counter may only step by one.
    expect(sql).toMatch(/new\.submitted_at < now\(\) - interval '5 minutes'/);
    expect(sql).toMatch(/old\.resubmission_count \+ 1/);
  });

  it("owner-inserted document rows are forced pristine (round-2 M2: no self-verified docs)", () => {
    expect(sql).toMatch(/create or replace function public\.guard_professional_document_insert\(\)/);
    expect(sql).toMatch(/new\.review_status := 'pending'/);
    expect(sql).toMatch(/new\.reviewed_by\s+:= null/);
    expect(sql).toMatch(/new\.created_at\s+:= now\(\)/);
    expect(sql).toMatch(/create trigger trg_pro_document_insert_guard\s+before insert on public\.professional_documents/);
  });

  it("APPLY_PENDING_0037.sql (the prod copy) matches the migration byte-for-byte after its paste header", () => {
    const applyPending = readFileSync(join(ROOT, "APPLY_PENDING_0037.sql"), "utf8");
    const [header, ...rest] = applyPending.split("\n");
    expect(header).toMatch(/paste this into the supabase sql editor/i);
    expect(rest.join("\n")).toBe(sql);
  });

  it("the applicant server actions accept the rejected status (blocker B1 regression)", () => {
    // saveApplicationDraftAction's early status guard bypassed sectionEditable and
    // silently discarded every edit a rejected pro made. Assert both actions'
    // lifecycle checks include 'rejected' so the wizard never renders editable
    // fields the server refuses to save.
    const actions = readFileSync(join(ROOT, "src/lib/pro/application-actions.ts"), "utf8");
    expect(actions).toMatch(/status !== "draft" && status !== "needs_more_info" && status !== "rejected"/);
    expect(actions).toMatch(/app\.status !== "draft" && app\.status !== "needs_more_info" && app\.status !== "rejected"/);
  });

  it("missing 0037 RPC falls back to the legacy submit path — a pending migration never takes down first-time submits", () => {
    const actions = readFileSync(join(ROOT, "src/lib/pro/application-actions.ts"), "utf8");
    expect(actions).toMatch(/legacySubmitFallback\(supabase, user\.id, app\.status\)/);
    expect(actions).toMatch(/async function legacySubmitFallback/);
    // Rejected-resubmit genuinely needs 0037 (old trigger refuses it) → honest copy.
    expect(actions).toContain("Resubmitting after a rejection isn't available just yet.");
  });

  it("missing 0037 RPC fails with customer-safe copy, not PostgREST internals", () => {
    const actions = readFileSync(join(ROOT, "src/lib/pro/application-actions.ts"), "utf8");
    expect(actions).toContain('error.code === "PGRST202"');
    expect(actions).toContain('error.code === "42883"');
  });
});
