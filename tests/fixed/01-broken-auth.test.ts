import { describe, it, expect } from "vitest";
import { login, SEEDED_ADMIN, SEEDED_MEMBER } from "../support/http";

/**
 * BUGS.md #1 -- Broken auth (acceptance criteria).
 *
 * Once fixed: valid credentials log in successfully (2xx/302, with a real,
 * non-empty session cookie), and wrong credentials are rejected with 401 --
 * not a 500, and not a 200 with an error payload (see #3b for that specific
 * failure mode).
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once bug #1 is fixed.
 */
describe("fixed: bug #1 broken auth", () => {
  it("logging in with valid seeded admin credentials succeeds and sets a session cookie", async () => {
    const { res, sessionCookie, body } = await login(SEEDED_ADMIN.email, SEEDED_ADMIN.password);

    expect([200, 201, 302]).toContain(res.status);
    expect(sessionCookie, "expected a non-empty session cookie to be set").toBeTruthy();
    expect(body).toBeTruthy();
  });

  it("logging in with valid seeded member credentials succeeds and sets a session cookie", async () => {
    const { res, sessionCookie, body } = await login(SEEDED_MEMBER.email, SEEDED_MEMBER.password);

    expect([200, 201, 302]).toContain(res.status);
    expect(sessionCookie, "expected a non-empty session cookie to be set").toBeTruthy();
    expect(body).toBeTruthy();
  });

  it("logging in with the wrong password is rejected with 401, not a masked success", async () => {
    const { res, sessionCookie } = await login(SEEDED_MEMBER.email, "definitely-the-wrong-password");

    expect(res.status).toBe(401);
    expect(sessionCookie, "no session cookie should be set on a failed login").toBeNull();
  });
});
