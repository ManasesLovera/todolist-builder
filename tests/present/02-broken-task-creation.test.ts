import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, loginAsMember, url } from "../support/http";

/**
 * BUGS.md #2 -- Broken task creation.
 *
 * Symptom: ORM misuse (create() called with a field that doesn't exist on
 * the schema, or a required relation omitted) means "Add task" does nothing
 * or 500s, with the root cause hidden the same way as bug #1.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #2 broken task creation", () => {
  let memberCookie: string;
  let listId: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();

    const createListRes = await fetch(url("/api/lists"), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: `bug2-fixture-list-${Date.now()}` }),
    });
    if (!createListRes.ok) {
      throw new Error(
        `Setup step failed: could not create a fixture TodoList (HTTP ${createListRes.status}). ` +
          `This test needs list creation to work so it can isolate item/task creation specifically.`,
      );
    }
    const { list } = (await createListRes.json()) as { list: { id: string } };
    listId = list.id;
  });

  it("adding a task to a list does not actually succeed", async () => {
    const title = `bug2-task-${Date.now()}`;
    const createItemRes = await fetch(url(`/api/lists/${listId}/items`), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title }),
    });

    let itemActuallyPresent = false;
    if (createItemRes.ok) {
      // The create call *looked* fine -- double check the item is actually
      // there, in case the bug manifests as "200 with an error payload" or
      // a create() that silently no-ops rather than a hard failure.
      const listDetailRes = await fetch(url(`/api/lists/${listId}`), {
        headers: authHeaders(memberCookie),
      });
      if (listDetailRes.ok) {
        const { list } = (await listDetailRes.json()) as {
          list: { items: { title: string }[] };
        };
        itemActuallyPresent = list.items.some((item) => item.title === title);
      }
    }

    const creationTrulySucceeded = createItemRes.ok && itemActuallyPresent;

    expect(
      creationTrulySucceeded,
      `Expected task creation to currently be broken (bug #2), but it looked ` +
        `successful: status=${createItemRes.status}, itemActuallyPresent=${itemActuallyPresent}`,
    ).toBe(false);
  });
});
