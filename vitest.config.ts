import { defineConfig } from "vitest/config";

/**
 * These are HTTP-level integration tests against a running instance of the
 * app (local `npm run dev`/`npm run start`, or the docker-compose stack —
 * see TESTING.md). Plain Node environment is all that's needed since tests
 * only use `fetch` against TEST_BASE_URL; there is no DOM/component
 * rendering under test here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    // Bug scenarios mutate shared seeded data (e.g. create/delete lists,
    // change passwords) — run files serially to avoid cross-test races
    // against the same live server/database.
    fileParallelism: false,
  },
});
