import { test } from "vitest";

/**
 * BUGS.md #12 -- Client-side error boundary swallows errors.
 *
 * Symptom: triggering a broken UI state (e.g. editing a task with bad data)
 * shows a generic "Something went wrong" screen, and nothing about it
 * appears anywhere in the server logs.
 *
 * This is a React error boundary catching a render-time exception in the
 * browser, after hydration/interaction -- there is no server-renderable
 * HTTP request that reproduces it (a plain `fetch` never executes client
 * component code or React's render/commit phases), so there's no
 * meaningful best-effort HTTP-level check to write here. This genuinely
 * needs browser-level testing (e.g. Playwright/Chrome devtools), which is
 * out of scope for this HTTP-only suite.
 *
 * Manual verification steps:
 *   1. In the browser, open a todo list and put it into a state the UI
 *      doesn't expect (per BUGS.md: "editing a task with bad data").
 *   2. Confirm the client shows a generic "Something went wrong" boundary
 *      screen.
 *   3. Check the server logs (docker compose logs web / Grafana Explore)
 *      for the same time window and confirm nothing about the error was
 *      logged server-side.
 *
 * "Present" expectation: the boundary screen appears, with no corresponding
 * server log entry.
 */
test.skip("manual check: a broken client UI state triggers a silent error boundary", () => {});
