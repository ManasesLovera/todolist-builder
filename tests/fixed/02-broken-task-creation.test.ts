import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #2 -- Broken task creation (acceptance criteria).
 *
 * Once fixed: POST /api/lists/:listId/items with a valid title returns a
 * 2xx response, and the item genuinely shows up when the list is re-fetched.
 *
 * This test is expected to FAIL against the current (buggy) app and PASS
 * once bug #2 is fixed.
 */
describe("fixed: bug #2 broken task creation", () => {
  let memberCookie: string;
  let listId: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();

    const createListRes = await fetch(url("/api/lists"), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: `bug2-fixture-list-${Date.now()}` }),
    });
    expect(createListRes.status, "fixture list creation should succeed").toBe(201);
    const { list } = (await createListRes.json()) as { list: { id: string } };
    listId = list.id;
  });

  it("adding a task to a list succeeds and the task is actually persisted", async () => {
    const title = `bug2-task-${Date.now()}`;
    const createItemRes = await fetch(url(`/api/lists/${listId}/items`), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title }),
    });

    expect(createItemRes.status).toBe(201);

    const listDetailRes = await fetch(url(`/api/lists/${listId}`), {
      headers: authHeaders(memberCookie),
    });
    expect(listDetailRes.status).toBe(200);
    const { list } = (await listDetailRes.json()) as { list: { items: { title: string }[] } };
    expect(list.items.some((item) => item.title === title)).toBe(true);
  });
});
