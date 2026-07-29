import { describe, it, expect } from "vitest";
import { login, SEEDED_MEMBER } from "../support/http";

/**
 * BUGS.md #3 (umbrella "terrible exception handling") -- concrete case (b):
 * `200 OK` returned with an error payload on real failures. BUGS.md's own
 * example is exactly this: "failed login returns 200 { error: '...' }
 * instead of 401", so this targets a login attempt with a *wrong* password
 * against a real seeded account (distinct from bug #1's test, which uses
 * *correct* credentials -- this one is specifically about how a genuine
 * failure is reported).
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #3b 200-with-error-payload", () => {
  it("a failed login (wrong password) returns 200 instead of a real error status", async () => {
    const { res, sessionCookie, body } = await login(
      SEEDED_MEMBER.email,
      "definitely-the-wrong-password",
    );

    // A well-behaved app never sets a session cookie on failed credentials.
    // The bug's signature is: status 200, yet no real session was created.
    const looksLikeMaskedFailure = res.status === 200 && !sessionCookie;

    expect(
      looksLikeMaskedFailure,
      `Expected a failed login to currently be masked as a 200 with an error payload ` +
        `(bug #3b), but got status=${res.status}, sessionCookie=${sessionCookie}, ` +
        `body=${JSON.stringify(body)}`,
    ).toBe(true);
  });
});
