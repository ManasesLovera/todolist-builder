import { describe, it, beforeAll, expect } from "vitest";
import {
  authHeaders,
  loginAsAdmin,
  loginAsMember,
  looksLikeCleanJsonError,
  looksLikeRawStackTrace,
  SEEDED_MEMBER,
  url,
} from "../support/http";

/**
 * BUGS.md #3 (umbrella "terrible exception handling") -- concrete case (c):
 * raw, unformatted stack traces shown directly in the API response on
 * unexpected input, with no matching structured server-side log.
 *
 * We don't know which single handler this was injected into, so this is a
 * best-effort probe across a couple of plausible trigger points that
 * naturally hit a DB-level constraint violation (duplicate email), which is
 * the kind of "unexpected input" most likely to reach an unhandled
 * exception path: (1) a member changing their own profile email to one that
 * already belongs to another user, and (2) an admin creating a user with an
 * email that already exists. The present test passes if *either* probe
 * shows a raw/unstructured error surface.
 *
 * Caveat: if the actual injected bug lives somewhere else entirely, this
 * probe may not find it -- see TESTING.md's note on best-effort tests.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #3c raw stack trace leaked", () => {
  let memberCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    adminCookie = await loginAsAdmin();
  });

  it("an unexpected duplicate-email request leaks a raw/unstructured error somewhere", async () => {
    const probes: { label: string; res: Response; text: string }[] = [];

    const profileRes = await fetch(url("/api/profile"), {
      method: "PATCH",
      headers: authHeaders(memberCookie),
      // member@example.com trying to take over the admin's email.
      body: JSON.stringify({ email: "admin@example.com" }),
    });
    probes.push({ label: "PATCH /api/profile duplicate email", res: profileRes, text: await profileRes.clone().text() });

    const adminCreateRes = await fetch(url("/api/admin/users"), {
      method: "POST",
      headers: authHeaders(adminCookie),
      body: JSON.stringify({
        name: "Duplicate Probe",
        email: SEEDED_MEMBER.email, // already exists
        role: "MEMBER",
        password: "SomeValidPass123!",
      }),
    });
    probes.push({
      label: "POST /api/admin/users duplicate email",
      res: adminCreateRes,
      text: await adminCreateRes.clone().text(),
    });

    const leaked = probes.some(
      (p) =>
        looksLikeRawStackTrace(p.text) ||
        (p.res.status >= 500 && !looksLikeCleanJsonError(p.text)),
    );

    expect(
      leaked,
      `Expected at least one duplicate-email probe to leak a raw/unstructured error. Got: ` +
        JSON.stringify(probes.map((p) => ({ label: p.label, status: p.res.status }))),
    ).toBe(true);
  });
});
