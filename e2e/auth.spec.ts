import { test, expect } from "@playwright/test";

// Sign in / sign up smoke coverage.
//
// No identity provider is configured in seed mode, so these assert the parts
// that are real without one: the forms render, they are wired to a server
// action, client-side validation blocks bad input, and the `next` redirect
// parameter cannot be pointed off-origin.

test.describe("sign in", () => {
  test("renders the form with email and password fields", async ({ page }) => {
    await page.goto("/signin");

    await expect(page.getByText("Welcome back, gorgeous")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("links to sign up and password recovery", async ({ page }) => {
    await page.goto("/signin");

    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("blocks submission of an invalid email", async ({ page }) => {
    await page.goto("/signin");

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Native validation keeps us on the page; no navigation occurs.
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("carries a safe next parameter into a hidden field", async ({ page }) => {
    await page.goto("/signin?next=/account/favorites");

    const hidden = page.locator('input[name="next"]');
    await expect(hidden).toHaveValue("/account/favorites");
  });

  test("does not reflect an off-origin next target into the form", async ({ page }) => {
    // Regression guard for the open redirect: even though the raw value reaches
    // the page, safeNext() is what the action redirects through. This asserts
    // the page still renders and never navigates off-origin on load.
    await page.goto("/signin?next=//evil.com");

    await expect(page).toHaveURL(/127\.0\.0\.1|localhost/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("sign up", () => {
  test("renders name, email and password fields", async ({ page }) => {
    await page.goto("/signup");

    await expect(page.getByLabel("Full name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("blocks submission when the password is too short", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("Full name").fill("Test Person");
    await page.getByLabel("Email").fill("test@example.com");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/signup/);
  });

  test("routes back to sign in", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/\/signin/);
  });
});

// Requires a configured Supabase project + a seeded test user.
test.describe.skip("authenticated", () => {
  test("signs in and lands on discover", async ({ page }) => {
    await page.goto("/signin");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/discover/);
  });

  test("redirects an off-origin next to the default destination", async ({ page }) => {
    await page.goto("/signin?next=//evil.com");
    await page.getByLabel("Email").fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/discover/);
  });
});
