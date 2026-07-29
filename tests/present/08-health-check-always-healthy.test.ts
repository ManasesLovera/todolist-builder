import { describe, it, test, expect } from "vitest";
import { url } from "../support/http";

/**
 * BUGS.md #8 -- Health check that always returns healthy.
 *
 * Symptom: /api/health is hardcoded to `200 { status: "ok" }` without
 * checking DB connectivity. The authoritative way to prove this is to break
 * DB connectivity and confirm the endpoint still reports healthy -- but this
 * test suite deliberately does not take down shared infrastructure (see
 * TESTING.md), so that check is documented below as a manual step instead.
 *
 * The automated check here is a lighter, best-effort smoke test: confirm
 * the endpoint responds 200 with an "ok"-shaped body under normal
 * conditions. This alone can't distinguish a real check from a hardcoded
 * one (both look the same when the DB is actually up) -- see the `fixed`
 * counterpart for the (also best-effort) structural differentiator.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #8 health check always healthy", () => {
  it("GET /api/health responds 200 with an ok-shaped body under normal conditions", async () => {
    const res = await fetch(url("/api/health"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string };
    expect(String(body.status).toLowerCase()).toContain("ok");
  });

  // Not automatable without taking down shared DB infrastructure that other
  // concurrent tests/users may depend on. To fully confirm this bug by hand:
  //   1. docker compose stop postgres   (or otherwise break DATABASE_URL)
  //   2. curl http://localhost:3000/api/health
  //   3. Confirm it STILL reports 200/"ok" (the bug) instead of a 5xx/unhealthy
  //      status (the fix). See OBSERVABILITY.md for the stack layout.
  test.skip("manual check: /api/health still reports healthy when the DB is actually down", () => {});
});
