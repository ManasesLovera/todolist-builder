import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #9 -- Wrong/inconsistent HTTP status codes (acceptance criteria).
 * Once fixed: not-found requests return 404, and validation failures return
 * 400 -- never 500.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once bug #9 is fixed.
 */
describe("fixed: bug #9 wrong/inconsistent HTTP status codes", () => {
  let memberCookie: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
  });

  it("a request for a nonexistent list returns 404, not 500", async () => {
    const res = await fetch(url("/api/lists/00000000-0000-0000-0000-000000000000"), {
      headers: authHeaders(memberCookie),
    });
    expect(res.status).toBe(404);
  });

  it("an invalid list-creation payload returns 400, not 500", async () => {
    const res = await fetch(url("/api/lists"), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(400);
  });
});
