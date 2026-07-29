import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, ensureListWithItems, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #5 -- Broken delete (FK constraint swallowed).
 *
 * Symptom: deleting a TodoList that still has items throws a raw FK
 * constraint violation that's caught and ignored; the UI shows success but
 * the list (and, specifically, its child items) are still there on refresh.
 *
 * This is closely related to #3a (same root cause, same code path per
 * DESIGN.md section 2's note on the schema having no onDelete cascade) but
 * verifies the more FK-specific angle: not just that the list survives, but
 * that its *items* also survive untouched (nothing was partially deleted
 * either). Uses the seeded "Work" fallback (vs #3a's "Groceries") so the two
 * don't compete for the same seeded list if dynamic item creation is broken.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #5 broken delete (FK constraint swallowed)", () => {
  let memberCookie: string;
  let listId: string;
  let itemCountBefore: number;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    ({ listId, itemCount: itemCountBefore } = await ensureListWithItems(memberCookie, "Work"));
    if (itemCountBefore < 1) {
      throw new Error(
        `Setup step failed: fixture list ${listId} has no items, but this test needs a ` +
          `list with children to trigger the FK constraint in the first place.`,
      );
    }
  });

  it("deleting a list with items looks successful but both the list and its items survive", async () => {
    const deleteRes = await fetch(url(`/api/lists/${listId}`), {
      method: "DELETE",
      headers: authHeaders(memberCookie),
    });
    const deleteLookedSuccessful = deleteRes.status === 200 || deleteRes.status === 204;

    const refetchRes = await fetch(url(`/api/lists/${listId}`), {
      headers: authHeaders(memberCookie),
    });
    let itemCountAfter = -1;
    if (refetchRes.status === 200) {
      const { list } = (await refetchRes.json()) as { list: { items: unknown[] } };
      itemCountAfter = list.items.length;
    }

    const bugPresent =
      deleteLookedSuccessful && refetchRes.status === 200 && itemCountAfter === itemCountBefore;

    expect(
      bugPresent,
      `Expected the delete to look successful (status ${deleteRes.status}) while both the ` +
        `list (re-fetch status ${refetchRes.status}) and its ${itemCountBefore} item(s) ` +
        `(found ${itemCountAfter} afterward) are still there, documenting the FK-swallowed ` +
        `delete bug (#5).`,
    ).toBe(true);
  });
});
