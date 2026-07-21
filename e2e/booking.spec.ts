import { test, expect } from "@playwright/test";

// End-to-end booking flow against the deterministic seed (demo mode, no charge).
// Verifies service selection, availability slots, price review, and confirmation.

const PRO = "maya-rose-beauty";

test.describe("booking flow", () => {
  test("walks from service selection to a confirmed demo booking", async ({ page }) => {
    await page.goto(`/book/${PRO}`);

    // Step 1: choose a service.
    await expect(page.getByRole("heading", { name: /choose a service/i })).toBeVisible();
    await page.getByRole("button", { name: /Soft Glam/ }).first().click();

    // Step 2: pick a day that has availability, then a time slot.
    await expect(page.getByRole("heading", { name: /pick a time/i })).toBeVisible();
    const day = page.locator('button[aria-label^="Day"]:not([disabled])').first();
    await day.click();
    // First available time chip (formatted HH:MM).
    const slot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    await slot.click();

    // Step 3: review shows a total and a confirm CTA.
    await expect(page.getByRole("heading", { name: /review/i })).toBeVisible();
    await expect(page.getByText(/Total/)).toBeVisible();
    await page.getByRole("button", { name: /Confirm/ }).click();

    // Step 4: confirmation.
    await expect(page.getByRole("heading", { name: /Booking (created|confirmed)/i })).toBeVisible();
    await expect(page.getByText(/Booking ref/)).toBeVisible();
  });

  test("book CTA on a profile links into the flow", async ({ page }) => {
    await page.goto(`/professionals/${PRO}`);
    // A visible "Book now" CTA points into the booking flow (both viewports).
    const cta = page.locator(`a:visible[href="/book/${PRO}"]`).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText(/Book now/i);
  });
});
