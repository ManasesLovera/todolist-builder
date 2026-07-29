import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #9 -- Wrong/inconsistent HTTP status codes.
 *
 * Example mechanisms: "not found" returning 500 instead of 404, or a
 * validation failure returning 500 instead of 400. We don't know which
 * specific endpoint this was injected into, so this probes two classic
 * trigger points and passes if *either* shows the wrong status -- a
 * best-effort check, same reasoning as #3c.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #9 wrong/inconsistent HTTP status codes", () => {
  let memberCookie: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
  });

  it("at least one of {not-found, validation-failure} returns an unexpected status", async () => {
    const notFoundRes = await fetch(url("/api/lists/00000000-0000-0000-0000-000000000000"), {
      headers: authHeaders(memberCookie),
    });

    const validationFailureRes = await fetch(url("/api/lists"), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: "" }), // fails min(1) validation
    });

    const notFoundWrong = notFoundRes.status !== 404;
    const validationWrong = validationFailureRes.status !== 400;

    expect(
      notFoundWrong || validationWrong,
      `Expected at least one status code to be wrong (bug #9). Got: ` +
        `not-found -> ${notFoundRes.status} (expected 404), ` +
        `validation-failure -> ${validationFailureRes.status} (expected 400)`,
    ).toBe(true);
  });
});
