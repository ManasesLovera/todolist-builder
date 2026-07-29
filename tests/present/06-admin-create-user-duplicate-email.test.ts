import { describe, it, beforeAll, expect } from "vitest";
import {
  authHeaders,
  loginAsAdmin,
  looksLikeCleanJsonError,
  SEEDED_MEMBER,
  url,
} from "../support/http";

/**
 * BUGS.md #6 -- Admin "create user" fails on duplicate email.
 *
 * Symptom: no pre-check, no friendly error; the unique-constraint violation
 * is either swallowed (nothing happens, no user created, no message) or
 * leaks a raw DB error to the screen. BUGS.md explicitly allows either
 * manifestation, so this asserts loosely: the response is simply NOT the
 * well-behaved "clean 400 with a friendly message" shape, AND no duplicate
 * user was actually created either way.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #6 admin create-user duplicate email", () => {
  let adminCookie: string;

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();
  });

  it("creating a user with an email that already exists is not handled cleanly", async () => {
    const res = await fetch(url("/api/admin/users"), {
      method: "POST",
      headers: authHeaders(adminCookie),
      body: JSON.stringify({
        name: "Duplicate Email Attempt",
        email: SEEDED_MEMBER.email, // already belongs to the seeded member
        role: "MEMBER",
        password: "SomeValidPass123!",
      }),
    });
    const text = await res.text();

    const handledCleanly = res.status === 400 && looksLikeCleanJsonError(text);

    expect(
      !handledCleanly,
      `Expected duplicate-email user creation to currently be mishandled (bug #6), but ` +
        `it looked like a clean, friendly 400: status=${res.status}, body=${text.slice(0, 300)}`,
    ).toBe(true);
  });

  it("no duplicate user was actually created for that email", async () => {
    const usersRes = await fetch(url("/api/admin/users"), { headers: authHeaders(adminCookie) });
    expect(usersRes.status).toBe(200);
    const { users } = (await usersRes.json()) as { users: { email: string }[] };
    const matches = users.filter((u) => u.email === SEEDED_MEMBER.email);
    expect(matches.length).toBe(1);
  });
});
