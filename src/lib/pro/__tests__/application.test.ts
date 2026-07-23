import { describe, it, expect } from "vitest";
import {
  isValidHandle, isValidUrl, normalizeUrl, normalizeHandle, hasAtLeastOneLink,
  validateForSubmit, magicBytesMatch,
} from "../application";

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
