import { describe, it, expect } from "vitest";
import {
  HOME_STUDIO_QUESTIONS, REQUIRED_HOME_STUDIO_KEYS, PRO_AGREEMENTS, PRO_AGREEMENT_KEYS,
  needsHomeStudioAnswers, requiredHomeStudioAnswered, missingRequiredHomeStudioAnswers,
  homeStudioNeedsReview, canSeeExactAddress, approximateAddress, exactAddress, displayAddress,
  type LocationCompliance,
} from "../compliance";

const ALL_YES: LocationCompliance = Object.fromEntries(REQUIRED_HOME_STUDIO_KEYS.map((k) => [k, "yes"]));

describe("C2 — required home-studio answers", () => {
  it("only asks home-based pros", () => {
    expect(needsHomeStudioAnswers(["home_studio"])).toBe(true);
    expect(needsHomeStudioAnswers(["multiple"])).toBe(true);
    expect(needsHomeStudioAnswers(["salon_suite", "client_location"])).toBe(false);
    expect(needsHomeStudioAnswers([])).toBe(false);
  });

  it("treats an unanswered required question as incomplete", () => {
    expect(requiredHomeStudioAnswered({})).toBe(false);
    expect(missingRequiredHomeStudioAnswers({})).toEqual(REQUIRED_HOME_STUDIO_KEYS);
  });

  it("is satisfied once every required question has a yes or no", () => {
    expect(requiredHomeStudioAnswered(ALL_YES)).toBe(true);
    expect(missingRequiredHomeStudioAnswers(ALL_YES)).toEqual([]);
    const allNo: LocationCompliance = Object.fromEntries(REQUIRED_HOME_STUDIO_KEYS.map((k) => [k, "no"]));
    expect(requiredHomeStudioAnswered(allNo)).toBe(true);
  });

  it("ignores optional questions", () => {
    const optional = HOME_STUDIO_QUESTIONS.filter((q) => !q.required);
    expect(optional.length).toBeGreaterThan(0);
    const onlyOptional: LocationCompliance = Object.fromEntries(optional.map((q) => [q.key, "yes"]));
    expect(requiredHomeStudioAnswered(onlyOptional)).toBe(false);
    expect(requiredHomeStudioAnswered({ ...ALL_YES, ...onlyOptional })).toBe(true);
  });

  it("reports exactly which required answers are still missing", () => {
    const partial: LocationCompliance = { [REQUIRED_HOME_STUDIO_KEYS[0]]: "yes" };
    expect(missingRequiredHomeStudioAnswers(partial)).toEqual(REQUIRED_HOME_STUDIO_KEYS.slice(1));
  });

  // The bug C2 exists to fix: "unanswered" is a hard block, "no" is a review flag.
  // Conflating them let a pro skip every required question and sail through.
  it("separates 'unanswered' (block) from 'no' (review flag)", () => {
    expect(homeStudioNeedsReview({})).toBe(false);
    expect(requiredHomeStudioAnswered({})).toBe(false);

    const oneNo: LocationCompliance = { ...ALL_YES, [REQUIRED_HOME_STUDIO_KEYS[0]]: "no" };
    expect(homeStudioNeedsReview(oneNo)).toBe(true);
    expect(requiredHomeStudioAnswered(oneNo)).toBe(true);

    expect(homeStudioNeedsReview(ALL_YES)).toBe(false);
    expect(requiredHomeStudioAnswered(ALL_YES)).toBe(true);
  });

  it("does not raise a review flag from an optional 'no'", () => {
    const optionalNo = HOME_STUDIO_QUESTIONS.find((q) => !q.required)!;
    expect(homeStudioNeedsReview({ ...ALL_YES, [optionalNo.key]: "no" })).toBe(false);
  });
});

describe("legal agreements", () => {
  it("has both mandatory agreements with a pinned version", () => {
    expect(PRO_AGREEMENT_KEYS).toHaveLength(2);
    for (const k of PRO_AGREEMENT_KEYS) {
      expect(PRO_AGREEMENTS[k].version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(PRO_AGREEMENTS[k].text.length).toBeGreaterThan(40);
    }
  });

  it("never claims iGlamHer grants permission to operate", () => {
    expect(PRO_AGREEMENTS.marketplace_disclaimer.text).toMatch(/does not grant permission to operate/i);
    expect(PRO_AGREEMENTS.license_responsibility.text).toMatch(/I am responsible for obtaining and maintaining/i);
  });
});

describe("C3 — address privacy", () => {
  const full = {
    addressLine1: "1234 Rosewood Ave",
    addressLine2: "Apt 5B",
    neighborhood: "West Hollywood",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90069",
  };

  it("withholds the exact address from the public when the pin is hidden", () => {
    expect(canSeeExactAddress("public", true)).toBe(false);
    expect(canSeeExactAddress("public", false)).toBe(true);
  });

  it("always shows the exact address to admins and confirmed clients", () => {
    expect(canSeeExactAddress("admin", true)).toBe(true);
    expect(canSeeExactAddress("booked", true)).toBe(true);
  });

  it("approximate never leaks the street line, unit, or ZIP", () => {
    const approx = approximateAddress(full);
    expect(approx).toBe("West Hollywood, CA");
    expect(approx).not.toMatch(/1234|Rosewood|Apt|5B|90069/);
  });

  it("falls back to city when no neighborhood is on file", () => {
    expect(approximateAddress({ city: "Los Angeles", state: "CA" })).toBe("Los Angeles, CA");
    expect(approximateAddress({ city: "Los Angeles" })).toBe("Los Angeles");
  });

  it("never returns an empty label", () => {
    expect(approximateAddress({})).toBe("Area shared after booking");
  });

  it("exact address includes the street line and unit", () => {
    expect(exactAddress(full)).toBe("1234 Rosewood Ave Apt 5B, Los Angeles, CA, 90069");
  });

  it("pre-booking customers get the neighborhood, post-booking the street address", () => {
    const pre = displayAddress(full, { audience: "public", hideExactPin: true });
    expect(pre.exact).toBe(false);
    expect(pre.text).toBe("West Hollywood, CA");
    expect(pre.text).not.toMatch(/Rosewood/);

    const post = displayAddress(full, { audience: "booked", hideExactPin: true });
    expect(post.exact).toBe(true);
    expect(post.text).toMatch(/1234 Rosewood Ave Apt 5B/);
  });

  it("admins see the full address regardless of the pro's preference", () => {
    const seen = displayAddress(full, { audience: "admin", hideExactPin: true });
    expect(seen.exact).toBe(true);
    expect(seen.text).toMatch(/1234 Rosewood Ave/);
  });

  it("degrades to approximate when an entitled viewer has no address on file", () => {
    const none = displayAddress({ city: "Los Angeles" }, { audience: "booked", hideExactPin: true });
    expect(none.exact).toBe(false);
    expect(none.text).toBe("Los Angeles");
  });

  it("a pro who did not hide their pin still shows exact publicly", () => {
    const open = displayAddress(full, { audience: "public", hideExactPin: false });
    expect(open.exact).toBe(true);
  });
});
