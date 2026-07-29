import { test } from "vitest";

/**
 * BUGS.md #12 -- Client-side error boundary swallows errors (acceptance
 * criteria). Once fixed: the same broken UI state either no longer breaks
 * (the underlying data issue is handled gracefully), or if a boundary still
 * catches something, the error is also reported server-side (e.g. via a
 * client-side logging/reporting endpoint), so it's diagnosable.
 *
 * Same reasoning as the present-suite counterpart: this is a browser-level
 * React error boundary concern with no meaningful HTTP-only check
 * available. Written as a documented manual check per the task brief.
 *
 * Manual verification steps:
 *   1. Repeat the same broken UI state from the present-suite counterpart.
 *   2. Confirm the UI either handles it gracefully, or the error boundary
 *      screen is accompanied by a corresponding server-side log entry.
 *
 * "Fixed" expectation: no more silent, unlogged client-side failures.
 */
test.skip("manual check: a broken client UI state no longer fails silently/unlogged", () => {});
