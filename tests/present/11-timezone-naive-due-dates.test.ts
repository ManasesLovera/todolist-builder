import { describe, it, beforeAll, expect } from "vitest";
import { authHeaders, loginAsMember, localDateOnly, url } from "../support/http";

/**
 * BUGS.md #11 -- Timezone-naive due dates.
 *
 * Symptom: a task's due date displays as the wrong day (off by one) because
 * it's stored/compared without timezone normalization -- set "today" as due
 * date, see "yesterday."
 *
 * Caveat: depending on exactly how this was injected, it may manifest
 * purely in client-side rendering (e.g. formatting a UTC timestamp using
 * the *browser's* local timezone), which this HTTP-only test genuinely
 * cannot observe -- there's no browser involved. This test instead checks
 * for a *server-observable* round-trip shift: create an item with a precise
 * "local midnight, today" due date and confirm whether the calendar date
 * that comes back out of the API matches what was sent. If this bug turns
 * out to be purely a client-rendering issue, this test may not catch it --
 * cross-check by hand in the browser (create a task due "today", see what
 * date is displayed) if this test unexpectedly doesn't detect anything.
 *
 * This test is expected to PASS against the current (buggy) app.
 */
describe("present: bug #11 timezone-naive due dates", () => {
  let memberCookie: string;
  let listId: string;

  beforeAll(async () => {
    memberCookie = await loginAsMember();
    const createListRes = await fetch(url("/api/lists"), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: `bug11-fixture-list-${Date.now()}` }),
    });
    if (!createListRes.ok) {
      throw new Error(
        `Setup step failed: could not create a fixture TodoList (HTTP ${createListRes.status}). ` +
          `Note bug #2 (broken task creation) could also block this test's setup.`,
      );
    }
    const { list } = (await createListRes.json()) as { list: { id: string } };
    listId = list.id;
  });

  it("a due date set to 'today' (local midnight) comes back as a different calendar day", async () => {
    const now = new Date();
    const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dueDateIso = localMidnight.toISOString();
    const intendedDateOnly = localDateOnly(now);

    const createItemRes = await fetch(url(`/api/lists/${listId}/items`), {
      method: "POST",
      headers: authHeaders(memberCookie),
      body: JSON.stringify({ title: `bug11-item-${Date.now()}`, dueDate: dueDateIso }),
    });
    if (!createItemRes.ok) {
      throw new Error(
        `Setup step failed: could not create an item with a dueDate (HTTP ${createItemRes.status}). ` +
          `Note bug #2 (broken task creation) could also block this test's setup.`,
      );
    }
    const { item } = (await createItemRes.json()) as { item: { dueDate: string | null } };
    expect(item.dueDate, "expected the created item to carry a dueDate").toBeTruthy();

    const returnedDateOnly = String(item.dueDate).slice(0, 10);

    expect(
      returnedDateOnly,
      `Expected the returned due date's calendar day (${returnedDateOnly}) to differ from ` +
        `the intended day (${intendedDateOnly}), documenting bug #11. If they match, this ` +
        `particular round-trip didn't catch it -- the bug may be purely client-rendering-side ` +
        `(see file comment); cross-check by hand in the browser.`,
    ).not.toBe(intendedDateOnly);
  });
});
