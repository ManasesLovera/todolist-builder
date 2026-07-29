import { describe, it, expect } from "vitest";
import { login, SEEDED_MEMBER } from "../support/http";

/**
 * BUGS.md #3 concrete case (b): 200-with-error-payload (acceptance
 * criteria). Once fixed: a failed login returns a real 401, carries an
 * error field, and sets no session cookie.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once this failure mode is fixed.
 */
describe("fixed: bug #3b 200-with-error-payload", () => {
  it("a failed login (wrong password) returns 401 with an error body and no cookie", async () => {
    const { res, sessionCookie, body } = await login(
      SEEDED_MEMBER.email,
      "definitely-the-wrong-password",
    );

    expect(res.status).toBe(401);
    expect(sessionCookie).toBeNull();
    expect(body).toBeTruthy();
    expect(typeof (body as { error?: unknown })?.error).toBe("string");
  });
});
