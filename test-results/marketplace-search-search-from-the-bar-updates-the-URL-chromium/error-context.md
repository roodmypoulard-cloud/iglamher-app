# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: marketplace.spec.ts >> search >> search from the bar updates the URL
- Location: e2e/marketplace.spec.ts:35:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - link "iGlamHer home" [ref=e5] [cursor=pointer]:
        - /url: /discover
        - generic [ref=e6]:
          - img "iGlamHer" [ref=e8]
          - generic [ref=e9]: Beauty on Demand
      - navigation "Main" [ref=e10]:
        - link "Discover" [ref=e11] [cursor=pointer]:
          - /url: /discover
        - link "Bookings" [ref=e12] [cursor=pointer]:
          - /url: /bookings
        - link "Requests" [ref=e13] [cursor=pointer]:
          - /url: /requests
        - link "Messages" [ref=e14] [cursor=pointer]:
          - /url: /messages
        - link "Favorites" [ref=e15] [cursor=pointer]:
          - /url: /account/favorites
      - generic [ref=e16]:
        - link "Notifications" [ref=e17] [cursor=pointer]:
          - /url: /notifications
          - img [ref=e18]
        - link "Account settings" [ref=e20] [cursor=pointer]:
          - /url: /profile/settings
    - main [ref=e25]:
      - button "Back" [ref=e27]:
        - img [ref=e28]
        - generic [ref=e30]: Back
      - search [ref=e33]:
        - img
        - searchbox "Search professionals and services" [ref=e34]
      - generic [ref=e36]:
        - generic [ref=e37]: Sort
        - combobox "Sort" [ref=e38]:
          - option "Recommended" [selected]
          - option "Nearest"
          - option "Highest rated"
          - option "Most reviewed"
          - 'option "Price: low to high"'
          - option "Earliest availability"
      - generic [ref=e39]:
        - complementary [ref=e40]:
          - generic [ref=e41]:
            - heading "Filters" [level=2] [ref=e42]
            - generic [ref=e43]:
              - generic [ref=e44]:
                - paragraph [ref=e45]: Category
                - generic [ref=e46]:
                  - button "Hair" [ref=e47]
                  - button "Makeup" [ref=e48]
                  - button "Lashes" [ref=e49]
                  - button "Nails" [ref=e50]
                  - button "Stylist" [ref=e51]
              - generic [ref=e52]:
                - paragraph [ref=e53]: Service location
                - generic [ref=e54]:
                  - button "Any" [ref=e55]
                  - button "At studio" [ref=e56]
                  - button "Mobile" [ref=e57]
                  - button "Both" [ref=e58]
              - generic [ref=e59]:
                - paragraph [ref=e60]: Minimum rating
                - generic [ref=e61]:
                  - button "Any" [ref=e62]
                  - button "4★+" [ref=e63]
                  - button "4.5★+" [ref=e64]
                  - button "4.8★+" [ref=e65]
              - generic [ref=e66]:
                - paragraph [ref=e67]: Max distance
                - generic [ref=e68]:
                  - button "Any" [ref=e69]
                  - button "5 mi" [ref=e70]
                  - button "10 mi" [ref=e71]
                  - button "25 mi" [ref=e72]
              - generic [ref=e73]:
                - paragraph [ref=e74]: Price
                - generic [ref=e75]:
                  - spinbutton "Minimum price" [ref=e76]
                  - generic [ref=e77]: –
                  - spinbutton "Maximum price" [ref=e78]
              - generic [ref=e79]:
                - generic [ref=e80]:
                  - generic [ref=e81]: Verified only
                  - checkbox "Verified only" [ref=e82]
                - generic [ref=e83]:
                  - generic [ref=e84]: Instant booking
                  - checkbox "Instant booking" [ref=e85]
        - generic [ref=e86]:
          - paragraph [ref=e87]: 10 professionals
          - generic [ref=e88]:
            - link "Featured Save to favorites Maya R. Bridal & editorial makeup 5.0 out of 5, 2 reviews Studio & mobile · Downtown LA from $65 0.0 mi away" [ref=e89] [cursor=pointer]:
              - /url: /professionals/maya-rose-beauty
              - generic [ref=e90]:
                - generic [ref=e91]: Featured
                - button "Save to favorites" [ref=e93]:
                  - img [ref=e94]
              - generic [ref=e96]:
                - paragraph [ref=e97]:
                  - text: Maya R.
                  - img [ref=e98]
                - paragraph [ref=e100]: Bridal & editorial makeup
                - paragraph [ref=e101]:
                  - generic [ref=e102]:
                    - generic [ref=e103]:
                      - generic [ref=e104]: ★
                      - generic [ref=e105]: "5.0"
                      - generic [ref=e106]: (2)
                    - generic [ref=e107]: 5.0 out of 5, 2 reviews
                - paragraph [ref=e108]:
                  - generic [ref=e109]: Studio & mobile · Downtown LA
                  - generic [ref=e110]: from $65
                - paragraph [ref=e111]: 0.0 mi away
            - link "Featured Save to favorites Amara B. Bridal glam 5.0 out of 5, 2 reviews Studio & mobile · Hollywood from $90 5.9 mi away" [ref=e112] [cursor=pointer]:
              - /url: /professionals/amara-beauty
              - generic [ref=e113]:
                - generic [ref=e114]: Featured
                - button "Save to favorites" [ref=e116]:
                  - img [ref=e117]
              - generic [ref=e119]:
                - paragraph [ref=e120]:
                  - text: Amara B.
                  - img [ref=e121]
                - paragraph [ref=e123]: Bridal glam
                - paragraph [ref=e124]:
                  - generic [ref=e125]:
                    - generic [ref=e126]:
                      - generic [ref=e127]: ★
                      - generic [ref=e128]: "5.0"
                      - generic [ref=e129]: (2)
                    - generic [ref=e130]: 5.0 out of 5, 2 reviews
                - paragraph [ref=e131]:
                  - generic [ref=e132]: Studio & mobile · Hollywood
                  - generic [ref=e133]: from $90
                - paragraph [ref=e134]: 5.9 mi away
            - link "Featured Save to favorites Dee Styles Protective styles & installs 4.9 out of 5, 2 reviews Mobile · Inglewood from $110 8.2 mi away" [ref=e135] [cursor=pointer]:
              - /url: /professionals/dee-styles-studio
              - generic [ref=e136]:
                - generic [ref=e137]: Featured
                - button "Save to favorites" [ref=e139]:
                  - img [ref=e140]
              - generic [ref=e142]:
                - paragraph [ref=e143]:
                  - text: Dee Styles
                  - img [ref=e144]
                - paragraph [ref=e146]: Protective styles & installs
                - paragraph [ref=e147]:
                  - generic [ref=e148]:
                    - generic [ref=e149]:
                      - generic [ref=e150]: ★
                      - generic [ref=e151]: "4.9"
                      - generic [ref=e152]: (2)
                    - generic [ref=e153]: 4.9 out of 5, 2 reviews
                - paragraph [ref=e154]:
                  - generic [ref=e155]: Mobile · Inglewood
                  - generic [ref=e156]: from $110
                - paragraph [ref=e157]: 8.2 mi away
            - link "Featured Save to favorites Simone V. Wardrobe & event styling 5.0 out of 5, 1 reviews Studio & mobile · West Hollywood from $120 7.4 mi away" [ref=e158] [cursor=pointer]:
              - /url: /professionals/simone-v-styling
              - generic [ref=e159]:
                - generic [ref=e161]: Featured
                - button "Save to favorites" [ref=e163]:
                  - img [ref=e164]
              - generic [ref=e166]:
                - paragraph [ref=e167]:
                  - text: Simone V.
                  - img [ref=e168]
                - paragraph [ref=e170]: Wardrobe & event styling
                - paragraph [ref=e171]:
                  - generic [ref=e172]:
                    - generic [ref=e173]:
                      - generic [ref=e174]: ★
                      - generic [ref=e175]: "5.0"
                      - generic [ref=e176]: (1)
                    - generic [ref=e177]: 5.0 out of 5, 1 reviews
                - paragraph [ref=e178]:
                  - generic [ref=e179]: Studio & mobile · West Hollywood
                  - generic [ref=e180]: from $120
                - paragraph [ref=e181]: 7.4 mi away
            - link "Save to favorites Nina K. Healthy natural hair 5.0 out of 5, 1 reviews Studio & mobile · Culver City from $55 8.7 mi away" [ref=e182] [cursor=pointer]:
              - /url: /professionals/nina-k-hair
              - button "Save to favorites" [ref=e186]:
                - img [ref=e187]
              - generic [ref=e189]:
                - paragraph [ref=e190]:
                  - text: Nina K.
                  - img [ref=e191]
                - paragraph [ref=e193]: Healthy natural hair
                - paragraph [ref=e194]:
                  - generic [ref=e195]:
                    - generic [ref=e196]:
                      - generic [ref=e197]: ★
                      - generic [ref=e198]: "5.0"
                      - generic [ref=e199]: (1)
                    - generic [ref=e200]: 5.0 out of 5, 1 reviews
                - paragraph [ref=e201]:
                  - generic [ref=e202]: Studio & mobile · Culver City
                  - generic [ref=e203]: from $55
                - paragraph [ref=e204]: 8.7 mi away
            - link "Save to favorites Priya N. Hybrid lashes 4.8 out of 5, 1 reviews Studio & mobile · Glendale from $60 7.0 mi away" [ref=e205] [cursor=pointer]:
              - /url: /professionals/lux-lash-bar
              - button "Save to favorites" [ref=e209]:
                - img [ref=e210]
              - generic [ref=e212]:
                - paragraph [ref=e213]:
                  - text: Priya N.
                  - img [ref=e214]
                - paragraph [ref=e216]: Hybrid lashes
                - paragraph [ref=e217]:
                  - generic [ref=e218]:
                    - generic [ref=e219]:
                      - generic [ref=e220]: ★
                      - generic [ref=e221]: "4.8"
                      - generic [ref=e222]: (1)
                    - generic [ref=e223]: 4.8 out of 5, 1 reviews
                - paragraph [ref=e224]:
                  - generic [ref=e225]: Studio & mobile · Glendale
                  - generic [ref=e226]: from $60
                - paragraph [ref=e227]: 7.0 mi away
            - link "Save to favorites Bella O. Volume lashes 4.8 out of 5, 1 reviews Studio · Pasadena from $55 9.4 mi away" [ref=e228] [cursor=pointer]:
              - /url: /professionals/bella-lash-lab
              - button "Save to favorites" [ref=e232]:
                - img [ref=e233]
              - generic [ref=e235]:
                - paragraph [ref=e236]:
                  - text: Bella O.
                  - img [ref=e237]
                - paragraph [ref=e239]: Volume lashes
                - paragraph [ref=e240]:
                  - generic [ref=e241]:
                    - generic [ref=e242]:
                      - generic [ref=e243]: ★
                      - generic [ref=e244]: "4.8"
                      - generic [ref=e245]: (1)
                    - generic [ref=e246]: 4.8 out of 5, 1 reviews
                - paragraph [ref=e247]:
                  - generic [ref=e248]: Studio · Pasadena
                  - generic [ref=e249]: from $55
                - paragraph [ref=e250]: 9.4 mi away
            - link "Save to favorites Jade C. Natural glam 4.9 out of 5, 1 reviews Mobile · Santa Monica from $90 14.1 mi away" [ref=e251] [cursor=pointer]:
              - /url: /professionals/jade-glow-makeup
              - button "Save to favorites" [ref=e254]:
                - img [ref=e255]
              - generic [ref=e257]:
                - paragraph [ref=e258]:
                  - text: Jade C.
                  - img [ref=e259]
                - paragraph [ref=e261]: Natural glam
                - paragraph [ref=e262]:
                  - generic [ref=e263]:
                    - generic [ref=e264]:
                      - generic [ref=e265]: ★
                      - generic [ref=e266]: "4.9"
                      - generic [ref=e267]: (1)
                    - generic [ref=e268]: 4.9 out of 5, 1 reviews
                - paragraph [ref=e269]:
                  - generic [ref=e270]: Mobile · Santa Monica
                  - generic [ref=e271]: from $90
                - paragraph [ref=e272]: 14.1 mi away
            - link "Save to favorites Tori A. Braiding 4.7 out of 5, 1 reviews Studio · Long Beach from $80 18.9 mi away" [ref=e273] [cursor=pointer]:
              - /url: /professionals/crown-by-tori
              - button "Save to favorites" [ref=e276]:
                - img [ref=e277]
              - generic [ref=e279]:
                - paragraph [ref=e280]:
                  - text: Tori A.
                  - img [ref=e281]
                - paragraph [ref=e283]: Braiding
                - paragraph [ref=e284]:
                  - generic [ref=e285]:
                    - generic [ref=e286]:
                      - generic [ref=e287]: ★
                      - generic [ref=e288]: "4.7"
                      - generic [ref=e289]: (1)
                    - generic [ref=e290]: 4.7 out of 5, 1 reviews
                - paragraph [ref=e291]:
                  - generic [ref=e292]: Studio · Long Beach
                  - generic [ref=e293]: from $80
                - paragraph [ref=e294]: 18.9 mi away
            - link "Save to favorites Remy D. Precision cuts 4.6 out of 5, 1 reviews Mobile · Burbank from $45 10.3 mi away" [ref=e295] [cursor=pointer]:
              - /url: /professionals/remy-cuts
              - button "Save to favorites" [ref=e299]:
                - img [ref=e300]
              - generic [ref=e302]:
                - paragraph [ref=e303]: Remy D.
                - paragraph [ref=e304]: Precision cuts
                - paragraph [ref=e305]:
                  - generic [ref=e306]:
                    - generic [ref=e307]:
                      - generic [ref=e308]: ★
                      - generic [ref=e309]: "4.6"
                      - generic [ref=e310]: (1)
                    - generic [ref=e311]: 4.6 out of 5, 1 reviews
                - paragraph [ref=e312]:
                  - generic [ref=e313]: Mobile · Burbank
                  - generic [ref=e314]: from $45
                - paragraph [ref=e315]: 10.3 mi away
  - alert [ref=e316]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | 
  3   | // Search, professional profile and favorites.
  4   | // These run against the deterministic seed in src/lib/data/seed.ts.
  5   | 
  6   | const SEED_PRO_SLUG = "maya-rose-beauty";
  7   | // Cards and profile headings render displayName, not businessName.
  8   | const SEED_PRO_NAME = "Maya R.";
  9   | const SEED_PRO_HREF = `a[href="/professionals/${SEED_PRO_SLUG}"]`;
  10  | 
  11  | // The search input is a controlled field identified by its aria-label.
  12  | const SEARCH_INPUT = "Search professionals and services";
  13  | 
  14  | test.describe("search", () => {
  15  |   test("lists professionals and reports a result count", async ({ page }) => {
  16  |     await page.goto("/search");
  17  | 
  18  |     await expect(page.getByText(/\d+ professionals?/)).toBeVisible();
  19  |     await expect(page.locator(SEED_PRO_HREF).first()).toBeVisible();
  20  |   });
  21  | 
  22  |   test("narrows results by query and echoes the term", async ({ page }) => {
  23  |     await page.goto("/search?q=braids");
  24  | 
  25  |     await expect(page.getByText(/for “braids”|No matches for “braids”/)).toBeVisible();
  26  |   });
  27  | 
  28  |   test("shows an empty state for a query that matches nothing", async ({ page }) => {
  29  |     await page.goto("/search?q=zzzznotarealservice");
  30  | 
  31  |     await expect(page.getByText(/No matches for/)).toBeVisible();
  32  |     await expect(page.getByText(/Try a broader search/)).toBeVisible();
  33  |   });
  34  | 
  35  |   test("search from the bar updates the URL", async ({ page }) => {
  36  |     await page.goto("/search");
  37  | 
  38  |     // SearchBar is a client component: onSubmit calls preventDefault and
  39  |     // router.push. Until it hydrates, Enter triggers a *native* GET submit and
  40  |     // the input carries no `name`, so the query is silently dropped ("/search?").
  41  |     // Wait for hydration so this asserts the real behaviour.
> 42  |     await page.waitForLoadState("networkidle");
      |                ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  43  | 
  44  |     const input = page.getByLabel(SEARCH_INPUT);
  45  |     await input.fill("hair");
  46  |     await expect(input).toHaveValue("hair");
  47  |     await input.press("Enter");
  48  | 
  49  |     await expect(page).toHaveURL(/[?&]q=hair/);
  50  |   });
  51  | });
  52  | 
  53  | test.describe("professional profile", () => {
  54  |   test("renders the profile for a seeded professional", async ({ page }) => {
  55  |     await page.goto(`/professionals/${SEED_PRO_SLUG}`);
  56  | 
  57  |     await expect(page.getByRole("heading", { level: 1 })).toContainText(SEED_PRO_NAME);
  58  |   });
  59  | 
  60  |   test("is reachable by clicking a search result", async ({ page }) => {
  61  |     await page.goto("/search");
  62  | 
  63  |     await page.locator(SEED_PRO_HREF).first().click();
  64  | 
  65  |     await expect(page).toHaveURL(new RegExp(`/professionals/${SEED_PRO_SLUG}`));
  66  |     await expect(page.getByRole("heading", { level: 1 })).toContainText(SEED_PRO_NAME);
  67  |   });
  68  | 
  69  |   test("sets a descriptive page title", async ({ page }) => {
  70  |     await page.goto(`/professionals/${SEED_PRO_SLUG}`);
  71  |     // generateMetadata builds "<displayName> · <specialty> · iGlamHer".
  72  |     await expect(page).toHaveTitle(/Maya R\..*iGlamHer/);
  73  |   });
  74  | 
  75  |   test("returns a not-found page for an unknown slug", async ({ page }) => {
  76  |     // The route streams (loading.tsx), so the browser status is 200 with the
  77  |     // not-found UI in the stream; crawlers still get a real 404 because
  78  |     // generateMetadata calls notFound() before streaming starts.
  79  |     await page.goto("/professionals/definitely-not-a-real-pro");
  80  |     await expect(page.getByText(/couldn['\u2019]t find/i)).toBeVisible();
  81  |   });
  82  | });
  83  | 
  84  | test.describe("favorites", () => {
  85  |   test("renders the favorites page with a heading", async ({ page }) => {
  86  |     await page.goto("/account/favorites");
  87  | 
  88  |     await expect(page.getByRole("heading", { name: "Favorites", exact: true })).toBeVisible();
  89  |     await expect(page.getByText("Your saved professionals.")).toBeVisible();
  90  |   });
  91  | 
  92  |   test("shows an empty state when nothing is saved", async ({ page }) => {
  93  |     // Seed mode starts with no favorites for an anonymous visitor.
  94  |     await page.goto("/account/favorites");
  95  | 
  96  |     await expect(page.getByRole("heading", { name: /no favorites yet/i })).toBeVisible();
  97  |   });
  98  | 
  99  |   test("exposes a favorite control on professional cards", async ({ page }) => {
  100 |     await page.goto("/search");
  101 | 
  102 |     const favButton = page.getByRole("button", { name: /favorite|save|heart/i }).first();
  103 |     await expect(favButton).toBeVisible();
  104 |   });
  105 | });
  106 | 
```