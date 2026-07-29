import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, loginAsMember, localDateOnly, url } from "../support/http";

/**
 * BUGS.md #11 -- Timezone-naive due dates (acceptance criteria). Once
 * fixed: a due date set to "today" round-trips back as the same calendar
 * day the caller intended -- no off-by-one shift.
 *
 * See the `present` counterpart's comment for the caveat that this bug may
 * partly/fully live in client-side rendering, which this HTTP-only test
 * can't observe -- cross-check by hand in the browser if needed.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once bug #11 is fixed.
 */
describe("fixed: bug #11 timezone-naive due dates", () => {
  let memberCookie: string;
  let listId: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    const createListRes = await fetch(url("/api/lists"), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: `bug11-fixture-list-${Date.now()}` }),
    });
    expect(createListRes.status).toBe(201);
    const { list } = (await createListRes.json()) as { list: { id: string } };
    listId = list.id;
  });

  it("a due date set to 'today' (local midnight) round-trips as the same calendar day", async () => {
    const now = new Date();
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dueDateIso = localMidnight.toISOString();
    const intendedDateOnly = localDateOnly(now);

    const createItemRes = await fetch(url(`/api/lists/${listId}/items`), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: `bug11-item-${Date.now()}`, dueDate: dueDateIso }),
    });
    expect(createItemRes.status).toBe(201);
    const { item } = (await createItemRes.json()) as { item: { dueDate: string | null } };
    expect(item.dueDate).toBeTruthy();

    const returnedDateOnly = String(item.dueDate).slice(0, 10);
    expect(returnedDateOnly).toBe(intendedDateOnly);
  });
});
