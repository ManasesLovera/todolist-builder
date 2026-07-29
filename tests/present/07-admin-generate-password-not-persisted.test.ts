import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, createThrowawayUser, login, loginAsAdmin, url } from "../support/http";

/**
 * BUGS.md #7 -- Admin "Generate Password" button doesn't actually work.
 *
 * Symptom: the button shows a generated password in the UI, but the handler
 * never persists the new hash, so the "new" password never actually works
 * at login. As suggested by the task brief, we verify this precisely the
 * way a human would: attempt to log in with the newly generated password.
 *
 * Uses a disposable throwaway user so this doesn't touch the seeded
 * admin/member accounts other test files depend on.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #7 admin generate-password doesn't persist", () => {
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

  it("the generated password does not actually work at login", async () => {
    const genRes = await fetch(url(`/api/admin/users/${userId}/generate-password`), {
      method: "POST",
      headers: authHeaders(adminCookie),
    });
    expect(genRes.status, "the endpoint itself should still respond with a generated password").toBe(200);
    const { password: newPassword } = (await genRes.json()) as { password: string };
    expect(newPassword).toBeTruthy();

    const { sessionCookie: newPasswordCookie } = await login(userEmail, newPassword);
    const { sessionCookie: originalPasswordCookie } = await login(userEmail, originalPassword);

    expect(
      Boolean(newPasswordCookie),
      `Expected the newly generated password NOT to work yet (bug #7), but login with it succeeded.`,
    ).toBe(false);
    expect(
      Boolean(originalPasswordCookie),
      `Expected the ORIGINAL password to still work (nothing was actually persisted), ` +
        `but it no longer logs in.`,
    ).toBe(true);
  });
});
