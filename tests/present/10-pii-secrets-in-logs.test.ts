import { test } from "vitest";

/**
 * BUGS.md #10 -- PII/secrets leaking into logs.
 *
 * Symptom: a debug log line dumps the full `user` object (including
 * `passwordHash`) or the raw login request body (plaintext password) to
 * stdout. Found by simply logging in once and reading the log output.
 *
 * This cannot be verified via HTTP responses alone -- the test process has
 * no visibility into the app server's stdout/log stream (whether that's a
 * local `npm run dev` terminal or the docker-compose `web` container's
 * logs, shipped onward to Loki per OBSERVABILITY.md). Written here as a
 * documented manual check per the task brief rather than an HTTP assertion.
 *
 * Manual verification steps:
 *   1. POST /api/auth/login with a real email + password (e.g. the seeded
 *      member@example.com / password123).
 *   2. Read the app's log output -- either directly
 *      (`docker compose logs web`, or the `npm run dev` terminal), or via
 *      Grafana Explore against the Loki datasource (see OBSERVABILITY.md).
 *   3. Confirm whether the login attempt (or any other request) logged the
 *      plaintext password, the request body verbatim, or a user record
 *      containing `passwordHash`.
 *
 * "Present" expectation: at least one of the above shows up in the logs.
 */
test.skip("manual check: logging in leaks plaintext password / passwordHash into logs", () => {});
