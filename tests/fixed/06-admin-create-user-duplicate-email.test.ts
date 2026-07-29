import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, loginAsAdmin, looksLikeRawStackTrace, SEEDED_MEMBER, url } from "../support/http";

/**
 * BUGS.md #6 -- Admin "create user" fails on duplicate email (acceptance
 * criteria). Once fixed: creating a user with a duplicate email returns a
 * clean 400 with a friendly error message (not a raw DB error, not a
 * silent no-op), and no duplicate user is created.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once bug #6 is fixed.
 */
describe("fixed: bug #6 admin create-user duplicate email", () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();
  });

  it("creating a user with an existing email returns a clean 400 with a friendly message", async () => {
    const res = await fetch(url("/api/admin/users"), {
      method: "POST",
      headers: authHeaders(adminCookie),
      body: JSON.stringify({
        name: "Duplicate Email Attempt",
        email: SEEDED_MEMBER.email,
        role: "MEMBER",
        password: "SomeValidPass123!",
      }),
    });
    const text = await res.text();

    expect(res.status).toBe(400);
    expect(looksLikeRawStackTrace(text)).toBe(false);
    const body = JSON.parse(text) as { error?: unknown };
    expect(typeof body.error).toBe("string");
  });

  it("no duplicate user was created for that email", async () => {
    const usersRes = await fetch(url("/api/admin/users"), { headers: authHeaders(adminCookie) });
    expect(usersRes.status).toBe(200);
    const { users } = (await usersRes.json()) as { users: { email: string }[] };
    const matches = users.filter((u) => u.email === SEEDED_MEMBER.email);
    expect(matches.length).toBe(1);
  });
});
