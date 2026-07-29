import { describe, it, test, expect } from "vitest";
import { url } from "../support/http";

/**
 * BUGS.md #8 -- Health check that always returns healthy (acceptance
 * criteria). Once fixed: /api/health performs a real DB connectivity check.
 *
 * Under normal conditions (DB up), a fixed health check still returns 200 --
 * so the only automatable differentiator here, without taking down shared
 * DB infrastructure, is structural: a real check plausibly reports *some*
 * evidence of what it checked (e.g. a nested `checks`/`database` field),
 * rather than a bare, unconditional `{ status: "ok" }`. This is a soft,
 * best-effort heuristic -- see the `test.skip` below for the authoritative
 * manual verification.
 *
 * This test is expected to FAIL against the current (buggy) app (the bare
 * hardcoded response won't show any evidence of a real check) and PASS once
 * bug #8 is fixed with a genuine DB check reflected in the response shape.
 */
describe("fixed: bug #8 health check always healthy", () => {
  it("GET /api/health response shows evidence of an actual DB check, not just a bare literal", async () => {
    const res = await fetch(url("/api/health"));
    expect(res.status).toBe(200);
    const text = await res.text();
    const bodyLower = text.toLowerCase();

    const showsRealCheckEvidence = /db|database|postgres|prisma|checks?/.test(bodyLower);

    expect(
      showsRealCheckEvidence,
      `Expected the health check response to show some evidence of a real DB check ` +
        `(e.g. a "checks"/"database" field), but got: ${text}`,
    ).toBe(true);
  });

  // Authoritative confirmation requires actually breaking DB connectivity:
  //   1. docker compose stop postgres   (or otherwise break DATABASE_URL)
  //   2. curl http://localhost:3000/api/health
  //   3. Confirm it now reports a non-200 / unhealthy status, proving the
  //      check is real. See OBSERVABILITY.md for the stack layout.
  test.skip("manual check: /api/health reports unhealthy when the DB is actually down", () => {});
});
