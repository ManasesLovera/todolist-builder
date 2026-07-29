import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, createThrowawayUser, login, loginAsAdmin, url } from "../support/http";

/**
 * BUGS.md #4 -- Broken profile update (acceptance criteria).
 *
 * Once fixed: PATCH /api/profile with a valid current password and new
 * password returns 2xx, and the new password genuinely works at login
 * afterward (while the old one no longer does).
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once bug #4 is fixed.
 */
describe("fixed: bug #4 broken profile update", () => {
  let userEmail: string;
  let oldPassword: string;
  let userCookie: string;

  beforeAll(async () => {
    const adminCookie = await loginAsAdmin();
    const user = await createThrowawayUser(adminCookie, "MEMBER");
    userEmail = user.email;
    oldPassword = user.password;

    const { res, sessionCookie } = await login(userEmail, oldPassword);
    expect(res.ok && Boolean(sessionCookie), "throwaway user login should succeed").toBe(true);
    userCookie = sessionCookie as string;
  });

  it("changing the account password succeeds and the new password actually works", async () => {
    const newPassword = "BrandNewPass456!";
    const patchRes = await fetch(url("/api/profile"), {
      method: "PATCH",
      headers: authHeaders(userCookie),
      body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
    });
    expect(patchRes.status).toBe(200);

    const { sessionCookie: newLoginCookie } = await login(userEmail, newPassword);
    expect(newLoginCookie, "the new password should now work").toBeTruthy();

    const { sessionCookie: oldLoginCookie } = await login(userEmail, oldPassword);
    expect(oldLoginCookie, "the old password should no longer work").toBeNull();
  });
});
