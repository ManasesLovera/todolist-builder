import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, createThrowawayUser, login, loginAsAdmin, url } from "../support/http";

/**
 * BUGS.md #7 -- Admin "Generate Password" button doesn't actually work
 * (acceptance criteria). Once fixed: the newly generated password is
 * genuinely persisted, so logging in with it succeeds, and the old password
 * no longer works.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once bug #7 is fixed.
 */
describe("fixed: bug #7 admin generate-password doesn't persist", () => {
  let adminCookie: string;
  let userId: string;
  let userEmail: string;
  let originalPassword: string;

  beforeAll(async () => {
    adminCookie = await loginAsAdmin();
    const user = await createThrowawayUser(adminCookie, "MEMBER");
    userId = user.id;
    userEmail = user.email;
    originalPassword = user.password;
  });

  it("the generated password is persisted and actually works at login", async () => {
    const genRes = await fetch(url(`/api/admin/users/${userId}/generate-password`), {
      method: "POST",
      headers: authHeaders(adminCookie),
    });
    expect(genRes.status).toBe(200);
    const { password: newPassword } = (await genRes.json()) as { password: string };
    expect(newPassword).toBeTruthy();

    const { sessionCookie: newPasswordCookie } = await login(userEmail, newPassword);
    expect(newPasswordCookie, "the new password should work").toBeTruthy();

    const { sessionCookie: originalPasswordCookie } = await login(userEmail, originalPassword);
    expect(originalPasswordCookie, "the old password should no longer work").toBeNull();
  });
});
