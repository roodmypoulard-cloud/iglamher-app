import { describe, it, expect } from "vitest";
import { scanForContactInfo, guardMessage } from "../contact-guard";

describe("contact-info guard — blocks pre-payment contact sharing", () => {
  it("allows normal booking chatter", () => {
    const r = scanForContactInfo("Hi! Can you do a soft glam on Saturday around noon?");
    expect(r.blocked).toBe(false);
    expect(r.violations).toHaveLength(0);
  });

  it("blocks phone numbers in several formats", () => {
    for (const t of ["Call me at 310-555-0199", "my number is (310) 555 0199", "+1 310 555 0199", "3105550199"]) {
      expect(scanForContactInfo(t).blocked, t).toBe(true);
      expect(scanForContactInfo(t).violations).toContain("phone");
    }
  });

  it("blocks spelled-out phone numbers", () => {
    const r = scanForContactInfo("three one zero five five five zero one nine nine");
    expect(r.blocked).toBe(true);
    expect(r.violations).toContain("phone");
  });

  it("blocks emails, including obfuscated ones", () => {
    expect(scanForContactInfo("email me maya@gmail.com").violations).toContain("email");
    const ob = scanForContactInfo("reach me at maya at gmail dot com");
    expect(ob.blocked).toBe(true);
    expect(ob.violations.some((v) => v === "email" || v === "evasion")).toBe(true);
  });

  it("blocks links and bare domains", () => {
    expect(scanForContactInfo("see my site https://maya.com/book").violations).toContain("url");
    expect(scanForContactInfo("check maya-glam.com").violations).toContain("url");
  });

  it("blocks social platforms and handles", () => {
    expect(scanForContactInfo("dm me on instagram").violations).toContain("social");
    expect(scanForContactInfo("find me on tiktok").violations).toContain("social");
    expect(scanForContactInfo("my ig is @mayaglam").blocked).toBe(true);
    expect(scanForContactInfo("add me @maya_glam").violations).toContain("handle");
  });

  it("blocks payment-app handoffs", () => {
    expect(scanForContactInfo("just venmo me directly").violations).toContain("social");
    expect(scanForContactInfo("pay me on cash app").violations).toContain("social");
  });

  it("redacts the detected contact info", () => {
    const r = scanForContactInfo("call 310-555-0199 or email a@b.com");
    expect(r.redacted).toContain("▇▇▇");
    expect(r.redacted).not.toContain("310-555-0199");
    expect(r.redacted).not.toContain("a@b.com");
  });

  it("produces a friendly, specific guard message", () => {
    const r = scanForContactInfo("call me 310-555-0199");
    expect(guardMessage(r)).toMatch(/phone numbers/);
    expect(guardMessage(r)).toMatch(/confirmed and paid/);
  });
});
