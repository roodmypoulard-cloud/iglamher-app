import { test, expect } from "@playwright/test";

// Professional service management.
//
// In seed mode getProContext() returns a demo professional (ctx.isDemo), so the
// dashboard renders without a session. These assert the management surface and
// its form validation. Persistence is NOT covered — saving requires a live
// Supabase project and a real pro account.

test.describe("pro services", () => {
  test("lists the professional's services with an active count", async ({ page }) => {
    await page.goto("/pro/services");

    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
    await expect(page.getByText(/\d+ active/)).toBeVisible();
  });

  test("offers a path to create a new service", async ({ page }) => {
    await page.goto("/pro/services");

    const newService = page.getByRole("link", { name: /new service/i });
    await expect(newService).toBeVisible();
    await newService.click();

    await expect(page).toHaveURL(/\/pro\/services\/new/);
  });

  test("new-service form renders its core pricing fields", async ({ page }) => {
    await page.goto("/pro/services/new");

    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    // Money is stored in integer cents; the form collects a price.
    await expect(page.getByLabel(/price/i).first()).toBeVisible();
    await expect(page.getByLabel(/duration/i).first()).toBeVisible();
  });

  test("blocks submission of an empty new-service form", async ({ page }) => {
    await page.goto("/pro/services/new");

    const submit = page.getByRole("button", { name: /save|create|add service/i }).first();
    await submit.click();

    // Server action is Zod-validated and the fields are required: we stay put.
    await expect(page).toHaveURL(/\/pro\/services\/new/);
  });

  test("profile and availability dashboard routes render", async ({ page }) => {
    await page.goto("/pro/profile");
    await expect(page.getByRole("heading").first()).toBeVisible();

    await page.goto("/pro/availability");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

// Requires a configured Supabase project + a professional test account.
test.describe.skip("pro services (persisted)", () => {
  test("creates, edits and archives a service", async ({ page }) => {
    await page.goto("/pro/services/new");
    await page.getByLabel(/name/i).first().fill("E2E Test Service");
    await page.getByLabel(/price/i).first().fill("120");
    await page.getByLabel(/duration/i).first().fill("60");
    await page.getByRole("button", { name: /save|create/i }).first().click();

    await expect(page).toHaveURL(/\/pro\/services/);
    await expect(page.getByText("E2E Test Service")).toBeVisible();
  });
});
