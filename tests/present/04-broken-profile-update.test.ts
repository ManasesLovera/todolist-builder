import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, createThrowawayUser, login, loginAsAdmin, url } from "../support/http";

/**
 * BUGS.md #4 -- Broken profile update.
 *
 * Symptom: editing name/email/password silently no-ops or throws an
 * uncaught error -- the same pattern as broken task creation, applied to
 * profile edit.
 *
 * Uses a disposable throwaway user (created via the admin API) rather than
 * the shared seeded member account, since this test needs to change a real
 * password -- doing that against member@example.com would break every other
 * test file that logs in with the seeded credentials.
 *
 * We verify persistence the same way BUGS.md suggests for #7 (generate
 * password): attempt to log in with the *new* password afterward. There's
 * no GET /api/profile endpoint to re-read state from, so this is the most
 * reliable HTTP-only way to confirm whether the change actually took.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #4 broken profile update", () => {
  let userEmail: string;
  let oldPassword: string;
  let userCookie: string;

  beforeAll(async () => {
    const adminCookie = await loginAsAdmin();
    const user = await createThrowawayUser(adminCookie, "MEMBER");
    userEmail = user.email;
    oldPassword = user.password;

    const { res, sessionCookie } = await login(userEmail, oldPassword);
    if (!res.ok || !sessionCookie) {
      throw new Error(
        `Setup step failed: could not log in as the freshly-created throwaway user ` +
          `(HTTP ${res.status}). Can't test profile update without a session.`,
      );
    }
    userCookie = sessionCookie;
  });

  it("changing the account password does not actually take effect", async () => {
    const newPassword = "BrandNewPass456!";
    const patchRes = await fetch(url("/api/profile"), {
      method: "PATCH",
      headers: authHeaders(userCookie),
      body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
    });

    const { sessionCookie: newLoginCookie } = await login(userEmail, newPassword);
    const newPasswordWorks = Boolean(newLoginCookie);

    const changeTrulyPersisted = patchRes.ok && newPasswordWorks;

    expect(
      changeTrulyPersisted,
      `Expected the profile password change to currently be broken (bug #4), but it ` +
        `looked successful: PATCH status=${patchRes.status}, new password logs in=${newPasswordWorks}`,
    ).toBe(false);
  });
});
