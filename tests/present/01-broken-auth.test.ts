import { describe, it, expect } from "vitest";
import { login, SEEDED_ADMIN, SEEDED_MEMBER } from "../support/http";

/**
 * BUGS.md #1 -- Broken auth.
 *
 * Symptom: login always fails/500s due to a wrong DB connection string or a
 * malformed Prisma client init, with the real error swallowed or shown as a
 * generic message with nothing logged.
 *
 * We can't know the exact status code or error shape the bug produces (a
 * 500, a hung request that eventually errors, a 200 with no cookie, etc.),
 * so this asserts loosely on the *symptom*: logging in with valid seeded
 * credentials does not result in a real, successful, cookie-bearing session.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #1 broken auth", () => {
  it("logging in with valid seeded admin credentials does not succeed", async () => {
    const { res, sessionCookie } = await login(SEEDED_ADMIN.email, SEEDED_ADMIN.password);

    const loginSucceeded =
      (res.status === 200 || res.status === 201 || res.status === 302) &&
      Boolean(sessionCookie);

    expect(
      loginSucceeded,
      `Expected login with valid admin credentials to currently be broken (bug #1), ` +
        `but it looked successful: status=${res.status}, sessionCookie=${sessionCookie}`,
    ).toBe(false);
  });

  it("logging in with valid seeded member credentials does not succeed", async () => {
    const { res, sessionCookie } = await login(SEEDED_MEMBER.email, SEEDED_MEMBER.password);

    const loginSucceeded =
      (res.status === 200 || res.status === 201 || res.status === 302) &&
      Boolean(sessionCookie);

    expect(
      loginSucceeded,
      `Expected login with valid member credentials to currently be broken (bug #1), ` +
        `but it looked successful: status=${res.status}, sessionCookie=${sessionCookie}`,
    ).toBe(false);
  });
});
