import { describe, it, expect } from "vitest";
import { safeNext } from "../safe-next";

describe("safeNext", () => {
  it("allows ordinary in-app paths", () => {
    expect(safeNext("/discover")).toBe("/discover");
    expect(safeNext("/professionals/maya-r")).toBe("/professionals/maya-r");
    expect(safeNext("/search?q=braids&city=miami")).toBe("/search?q=braids&city=miami");
    // Hyphens and dots are legitimate in paths.
    expect(safeNext("/pro/services/new-service.v2")).toBe("/pro/services/new-service.v2");
  });

  it("rejects protocol-relative URLs (the original bypass)", () => {
    // `//evil.com` passes a naive startsWith("/") check and browsers resolve it
    // to an external origin.
    expect(safeNext("//evil.com")).toBe("/discover");
    expect(safeNext("//evil.com/login")).toBe("/discover");
    expect(safeNext("///evil.com")).toBe("/discover");
  });

  it("rejects backslash variants browsers normalise to //", () => {
    expect(safeNext("/\\evil.com")).toBe("/discover");
    expect(safeNext("\\\\evil.com")).toBe("/discover");
    expect(safeNext("/path\\to\\evil")).toBe("/discover");
  });

  it("rejects absolute URLs and schemes", () => {
    expect(safeNext("https://evil.com")).toBe("/discover");
    expect(safeNext("http://evil.com")).toBe("/discover");
    expect(safeNext("javascript:alert(1)")).toBe("/discover");
    expect(safeNext("/javascript:alert(1)")).toBe("/discover");
  });

  it("rejects control characters that could smuggle header content", () => {
    expect(safeNext("/discover\r\nSet-Cookie: a=b")).toBe("/discover");
    expect(safeNext("/discover\nLocation: //evil.com")).toBe("/discover");
    expect(safeNext("/discover\u0000")).toBe("/discover");
  });

  it("falls back for empty and non-string input", () => {
    expect(safeNext("")).toBe("/discover");
    expect(safeNext(null)).toBe("/discover");
    expect(safeNext(undefined)).toBe("/discover");
    expect(safeNext(42)).toBe("/discover");
    expect(safeNext({})).toBe("/discover");
  });

  it("honours a custom fallback", () => {
    expect(safeNext("//evil.com", "/signin")).toBe("/signin");
  });
});
