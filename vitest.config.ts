import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Placeholder env so modules that validate env at import (lib/env) load in
    // unit tests. Individual tests (env.test) override these as needed.
    env: {
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
