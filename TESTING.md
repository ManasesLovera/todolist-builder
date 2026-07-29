# TESTING.md

HTTP-level acceptance tests for the bug catalog in `BUGS.md`. These tests run
against a **live instance** of the app (local dev server, `next start`, or
the docker-compose stack) over plain `fetch` -- they don't touch Prisma or
the database directly.

## 1. Getting the app running

Full observability stack details (Fluent Bit, Loki, Grafana) live in
[`OBSERVABILITY.md`](./OBSERVABILITY.md) -- this section only covers enough
to get the app itself reachable so the tests have something to hit.

Bring up the full stack (Postgres, the app, and the logging pipeline):

```bash
docker compose up --build
```

The app listens on `http://localhost:3000` (see `OBSERVABILITY.md` for the
other ports -- Grafana on `3001`, Postgres on `5432`, Loki on `3100`).

Once Postgres is up, run migrations and seed the database:

```bash
npx prisma migrate deploy   # or `npx prisma migrate dev` in local development
npx prisma db seed
```

This seeds two accounts (see `prisma/seed.ts`), both with password
`password123`:

| Email | Role |
| --- | --- |
| `admin@example.com` | ADMIN |
| `member@example.com` | MEMBER |

The seeded member account also gets two todo lists with items ("Groceries",
"Work") -- some of the test fixtures below fall back to these if dynamic
list/item creation is currently broken (see the "cross-bug dependencies"
note further down).

Note: `prisma/seed.ts` upserts the two users (safe to re-run) but plainly
`create()`s the two todo lists (not idempotent) -- if you need a truly clean
slate after a test run has consumed/deleted seed data, reset the Postgres
volume (`docker compose down -v`) and re-seed.

## 2. Running the tests

Install dependencies once:

```bash
npm install
```

Run the entire suite:

```bash
npm test
```

Run a single scenario:

```bash
npx vitest run tests/present/01-broken-auth.test.ts
npx vitest run tests/fixed/01-broken-auth.test.ts
```

`npm run test:watch` re-runs tests on file changes.

`TEST_BASE_URL` defaults to `http://localhost:3000` and can be overridden,
e.g. to point at a different host/port:

```bash
TEST_BASE_URL=http://localhost:3000 npm test
```

### Bug -> test file map

| # | Bug | Present test | Fixed (acceptance) test |
| --- | --- | --- | --- |
| 1 | Broken auth | `tests/present/01-broken-auth.test.ts` | `tests/fixed/01-broken-auth.test.ts` |
| 2 | Broken task creation | `tests/present/02-broken-task-creation.test.ts` | `tests/fixed/02-broken-task-creation.test.ts` |
| 3a | Empty catch swallowed delete | `tests/present/03a-empty-catch-swallowed-delete.test.ts` | `tests/fixed/03a-empty-catch-swallowed-delete.test.ts` |
| 3b | 200 OK with error payload | `tests/present/03b-200-with-error-payload.test.ts` | `tests/fixed/03b-200-with-error-payload.test.ts` |
| 3c | Raw stack trace leaked | `tests/present/03c-raw-stack-trace-leaked.test.ts` | `tests/fixed/03c-raw-stack-trace-leaked.test.ts` |
| 4 | Broken profile update | `tests/present/04-broken-profile-update.test.ts` | `tests/fixed/04-broken-profile-update.test.ts` |
| 5 | Broken delete (FK constraint swallowed) | `tests/present/05-broken-delete-fk-swallowed.test.ts` | `tests/fixed/05-broken-delete-fk-swallowed.test.ts` |
| 6 | Admin create-user duplicate email | `tests/present/06-admin-create-user-duplicate-email.test.ts` | `tests/fixed/06-admin-create-user-duplicate-email.test.ts` |
| 7 | Admin generate-password doesn't persist | `tests/present/07-admin-generate-password-not-persisted.test.ts` | `tests/fixed/07-admin-generate-password-not-persisted.test.ts` |
| 8 | Health check always healthy | `tests/present/08-health-check-always-healthy.test.ts` | `tests/fixed/08-health-check-always-healthy.test.ts` |
| 9 | Wrong/inconsistent HTTP status codes | `tests/present/09-wrong-http-status-codes.test.ts` | `tests/fixed/09-wrong-http-status-codes.test.ts` |
| 10 | PII/secrets in logs | `tests/present/10-pii-secrets-in-logs.test.ts` (skip, manual) | `tests/fixed/10-pii-secrets-in-logs.test.ts` (skip, manual) |
| 11 | Timezone-naive due dates | `tests/present/11-timezone-naive-due-dates.test.ts` | `tests/fixed/11-timezone-naive-due-dates.test.ts` |
| 12 | Client error boundary swallows errors | `tests/present/12-client-error-boundary-swallows-errors.test.ts` (skip, manual) | `tests/fixed/12-client-error-boundary-swallows-errors.test.ts` (skip, manual) |

Shared setup helpers (login, cookie handling, fixture creation) live in
`tests/support/http.ts`.

## 3. The present/fixed convention

Every bug gets **two** test files with (mostly) the same scenario:

- **`tests/present/*`** asserts the *current* (buggy) observable behavior
  described in `BUGS.md`. These are expected to **pass** right now, against
  the unfixed app -- they document that the bug exists.
- **`tests/fixed/*`** asserts the *correct* behavior a real fix should
  produce. These are expected to **fail** right now and only start passing
  once the underlying bug is actually fixed -- this suite is effectively the
  acceptance criteria / answer key.

Run both (`npm test` runs everything under `tests/`) to see exactly which
bugs remain: a passing `present` test + a failing `fixed` test for the same
bug means it's still broken; once the `fixed` test starts passing, that bug
is resolved (and, optionally, the matching `present` test can be expected to
start failing/be retired).

Two bugs (#10 PII/secrets in logs, #12 client error boundary) can't be
verified through HTTP responses alone -- #10 needs the server's actual log
output, and #12 is a browser-only React error boundary. Both are written as
`test.skip` stubs with the manual verification steps documented inline,
rather than asserting anything through `fetch`.

### A note on cross-bug dependencies

Several bugs need "a working session" or "a list with real items" purely as
a *setup* step, not as the thing under test. If bug #1 (broken auth) is
currently present, essentially every other test that needs to log in first
will fail its setup with a message pointing back at bug #1 -- that's
expected, not a false signal about the other bug. Similarly, the delete
tests (#3a, #5) fall back to the pre-seeded "Groceries"/"Work" lists (which
already have items from `prisma/seed.ts`, independent of the live create
endpoint) if dynamic item creation currently fails, so they can still be
exercised even while bug #2 is present. See the comments in
`tests/support/http.ts` and the individual test files for specifics.

A few scenarios (#3c raw stack trace, #9 wrong status codes) are written as
best-effort probes across a couple of plausible trigger points, since the
exact endpoint each bug was injected into wasn't known while these tests
were written -- see the comments in those files if a probe doesn't turn up
what's expected.
