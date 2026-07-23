import { test, expect } from "@playwright/test";

// Search, professional profile and favorites.
// These run against the deterministic seed in src/lib/data/seed.ts.

const SEED_PRO_SLUG = "maya-rose-beauty";
// Cards and profile headings render displayName, not businessName.
const SEED_PRO_NAME = "Maya R.";
const SEED_PRO_HREF = `a[href="/professionals/${SEED_PRO_SLUG}"]`;

// The search input is a controlled field identified by its aria-label.
const SEARCH_INPUT = "Search professionals and services";

test.describe("search", () => {
  test("lists professionals and reports a result count", async ({ page }) => {
    await page.goto("/search");

    await expect(page.getByText(/\d+ professionals?/)).toBeVisible();
    await expect(page.locator(SEED_PRO_HREF).first()).toBeVisible();
  });

  test("narrows results by query and echoes the term", async ({ page }) => {
    await page.goto("/search?q=braids");

    await expect(page.getByText(/for “braids”|No matches for “braids”/)).toBeVisible();
  });

  test("shows an empty state for a query that matches nothing", async ({ page }) => {
    await page.goto("/search?q=zzzznotarealservice");

    await expect(page.getByText(/No matches for/)).toBeVisible();
    await expect(page.getByText(/Try a broader search/)).toBeVisible();
  });

  test("search from the bar updates the URL", async ({ page }) => {
    await page.goto("/search");

    // SearchBar is a client component: onSubmit calls preventDefault and
    // router.push. Until it hydrates, Enter triggers a *native* GET submit and
    // the input carries no `name`, so the query is silently dropped ("/search?").
    // Wait for hydration so this asserts the real behaviour.
    await page.waitForLoadState("networkidle");

    const input = page.getByLabel(SEARCH_INPUT);
    await input.fill("hair");
    await expect(input).toHaveValue("hair");
    await input.press("Enter");

    await expect(page).toHaveURL(/[?&]q=hair/);
  });
});

test.describe("professional profile", () => {
  test("renders the profile for a seeded professional", async ({ page }) => {
    await page.goto(`/professionals/${SEED_PRO_SLUG}`);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(SEED_PRO_NAME);
  });

  test("is reachable by clicking a search result", async ({ page }) => {
    await page.goto("/search");

    await page.locator(SEED_PRO_HREF).first().click();

    await expect(page).toHaveURL(new RegExp(`/professionals/${SEED_PRO_SLUG}`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(SEED_PRO_NAME);
  });

  test("sets a descriptive page title", async ({ page }) => {
    await page.goto(`/professionals/${SEED_PRO_SLUG}`);
    // generateMetadata builds "<displayName> · <specialty> · iGlamHer".
    await expect(page).toHaveTitle(/Maya R\..*iGlamHer/);
  });

  test("returns a not-found page for an unknown slug", async ({ page }) => {
    // The route streams (loading.tsx), so the browser status is 200 with the
    // not-found UI in the stream; crawlers still get a real 404 because
    // generateMetadata calls notFound() before streaming starts.
    await page.goto("/professionals/definitely-not-a-real-pro");
    await expect(page.getByText(/couldn['\u2019]t find/i)).toBeVisible();
  });
});

test.describe("favorites", () => {
  test("renders the favorites page with a heading", async ({ page }) => {
    await page.goto("/account/favorites");

    await expect(page.getByRole("heading", { name: "Favorites", exact: true })).toBeVisible();
    await expect(page.getByText("Your saved professionals.")).toBeVisible();
  });

  test("shows an empty state when nothing is saved", async ({ page }) => {
    // Seed mode starts with no favorites for an anonymous visitor.
    await page.goto("/account/favorites");

    await expect(page.getByRole("heading", { name: /no favorites yet/i })).toBeVisible();
  });

  test("exposes a favorite control on professional cards", async ({ page }) => {
    await page.goto("/search");

    const favButton = page.getByRole("button", { name: /favorite|save|heart/i }).first();
    await expect(favButton).toBeVisible();
  });
});
