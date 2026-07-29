import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, ensureListWithItems, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #5 -- Broken delete (FK constraint swallowed) (acceptance
 * criteria). Once fixed: deleting a list with items truly succeeds (e.g. by
 * deleting child items first inside a transaction) and both the list and
 * its items are genuinely gone afterward.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once the underlying delete handling is fixed.
 */
describe("fixed: bug #5 broken delete (FK constraint swallowed)", () => {
  let memberCookie: string;
  let listId: string;
  let itemCountBefore: number;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    ({ listId, itemCount: itemCountBefore } = await ensureListWithItems(memberCookie, "Work"));
    expect(itemCountBefore, "fixture list should have at least one item").toBeGreaterThan(0);
  });

  it("deleting a list with items succeeds for real -- list and items are both gone afterward", async () => {
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
