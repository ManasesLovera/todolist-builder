import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, ensureListWithItems, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #3 (umbrella "terrible exception handling") -- concrete case (a):
 * empty `catch {}` blocks. BUGS.md's own example for this case is exactly
 * "delete silently 'succeeds' in the UI but the row is still in the DB", so
 * this test targets deleting a TodoList that still has items (no `onDelete`
 * cascade in the schema by design -- see DESIGN.md section 2 -- so this
 * throws an FK constraint violation that an empty catch would swallow).
 *
 * Distinguishing this from #5 (broken-delete-fk-swallowed): this test only
 * checks whether the *list itself* survives a "successful" delete. #5 goes a
 * step further and checks that the list's *items* also survive, which is
 * the more FK-violation-specific angle. It's expected the same underlying
 * code path is responsible for both.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #3a empty-catch swallowed delete", () => {
  let memberCookie: string;
  let listId: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    ({ listId } = await ensureListWithItems(memberCookie, "Groceries"));
  });

  it("deleting a list with items looks successful but the list is still there afterward", async () => {
    const deleteRes = await fetch(url(`/api/lists/${listId}`), {
      method: "DELETE",
      headers: authHeaders(memberCookie),
    });

    const deleteLookedSuccessful = deleteRes.status === 200 || deleteRes.status === 204;

    const refetchRes = await fetch(url(`/api/lists/${listId}`), {
      headers: authHeaders(memberCookie),
    });
    const listStillExists = refetchRes.status === 200;

    expect(
      deleteLookedSuccessful && listStillExists,
      `Expected the delete to look successful (status ${deleteRes.status}) while the ` +
        `list still actually exists afterward (re-fetch status ${refetchRes.status}), ` +
        `documenting the empty-catch-swallowed-delete bug (#3a).`,
    ).toBe(true);
  });
});
