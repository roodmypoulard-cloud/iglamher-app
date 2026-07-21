import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // CLAUDE.md requires responsive behaviour at 390px; the marketplace shell
    // is mobile-first, so the mobile viewport is a first-class target.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    // Run against a production build, not `next dev`. Dev relies on an HMR
    // websocket; where that handshake fails (sandboxes, some CI networks) the
    // client bundle never hydrates and every interaction test fails for a
    // reason that has nothing to do with the app.
    command: `npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    // Force deterministic SEED mode for e2e, independent of whatever live keys
    // are in .env.local. Real env vars take precedence over .env files in Next,
    // so this pins the test build to the in-memory seed dataset + demo flows.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
      STRIPE_SECRET_KEY: "",
      NEXT_PUBLIC_APP_URL: BASE_URL,
    },
  },
});
