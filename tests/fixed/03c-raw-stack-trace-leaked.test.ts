import { describe, it, beforeAll, expect } from "vitest";
import {
  authHeaders,
  loginAsAdmin,
  loginAsMember,
  looksLikeRawStackTrace,
  SEEDED_MEMBER,
  url,
} from "../support/http";

/**
 * BUGS.md #3 concrete case (c): raw-stack-trace-leaked (acceptance
 * criteria). Once fixed: unexpected/conflicting input (duplicate email, in
 * both the profile-update and admin-create-user paths) returns a clean
 * client error (4xx) with a friendly JSON `{ error }` body -- never a raw
 * stack trace, Prisma error class name, or file path.
 *
 * This test is expected to FAIL against the current (buggy) app (at least
 * one of these probes is likely to fail) and PASS once the leak is fixed.
 */
describe("fixed: bug #3c raw stack trace leaked", () => {
  let memberCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    adminCookie = await loginAsAdmin();
  });

  it("duplicate-email profile update returns a clean 4xx, never a raw stack trace", async () => {
    const res = await fetch(url("/api/profile"), {
      method: "PATCH",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ email: "admin@example.com" }),
    });
    const text = await res.text();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(looksLikeRawStackTrace(text)).toBe(false);
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("duplicate-email admin user creation returns a clean 4xx, never a raw stack trace", async () => {
    const res = await fetch(url("/api/admin/users"), {
      method: "POST",
      headers: authHeaders(adminCookie),
      body: JSON.stringify({
        name: "Duplicate Probe",
        email: SEEDED_MEMBER.email,
        role: "MEMBER",
        password: "SomeValidPass123!",
      }),
    });
    const text = await res.text();

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(looksLikeRawStackTrace(text)).toBe(false);
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
