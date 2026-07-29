import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, ensureListWithItems, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #3 concrete case (a): empty catch swallowed delete (acceptance
 * criteria). Once fixed: deleting a list with items truly succeeds (items
 * are deleted first, e.g. in a transaction) and the list is genuinely gone
 * afterward -- not silently retained behind a "successful" response.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once the underlying delete handling is fixed.
 */
describe("fixed: bug #3a empty-catch swallowed delete", () => {
  let memberCookie: string;
  let listId: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    ({ listId } = await ensureListWithItems(memberCookie, "Groceries"));
  });

  it("deleting a list with items succeeds for real -- the list is actually gone afterward", async () => {
    const deleteRes = await fetch(url(`/api/lists/${listId}`), {
      method: "DELETE",
      headers: authHeaders(memberCookie),
    });
    expect([200, 204]).toContain(deleteRes.status);

    const refetchRes = await fetch(url(`/api/lists/${listId}`), {
      headers: authHeaders(memberCookie),
    });
    expect(refetchRes.status).toBe(404);
  });
});
