import { test } from "vitest";

/**
 * BUGS.md #10 -- PII/secrets leaking into logs (acceptance criteria).
 *
 * Once fixed: no server log line contains a plaintext password, a raw
 * request body from an auth/profile endpoint, or a full `user` object
 * (including `passwordHash`).
 *
 * Same reasoning as the present-suite counterpart: this can't be checked
 * via HTTP responses, only by reading actual log output. Written as a
 * documented manual check per the task brief.
 *
 * Manual verification steps:
 *   1. POST /api/auth/login with a real email + password.
 *   2. Read the app's log output (`docker compose logs web`, the `npm run
 *      dev` terminal, or Grafana Explore against Loki -- see
 *      OBSERVABILITY.md).
 *   3. Confirm the plaintext password, raw request body, and passwordHash
 *      never appear anywhere in the logged output for that request.
 *
 * "Fixed" expectation: none of the above shows up in the logs.
 */
test.skip("manual check: logging in no longer leaks plaintext password / passwordHash into logs", () => {});
