# BUGS.md - Intentional Bug Catalog (Checklist)

Scope rule: every bug here must be **easy to notice just by using the app** (login
fails, a button doesn't work, a value is wrong) — the difficulty is entirely in
**finding the root cause**, because exception handling/logging is bad, not because the
bug itself is subtle, timing-dependent, or only shows up under load/concurrency.

Nothing here requires concurrent requests, waiting hours, seeding thousands of rows, or
generating traffic to reproduce. If it needs any of that, it's cut (see bottom).

Check a box once a bug is **approved for v1**.

---

## Required (from original brief)

- [ ] **Broken auth** — login fails due to wrong DB connection string or malformed
      Prisma client init. Symptom: login always fails/500s. Root cause hidden because
      the error is swallowed or shown as a generic message with nothing logged.
- [x] **Broken task creation** — ORM misuse: `create()` called with a field that
      doesn't exist on the schema, or a required relation omitted. Symptom: "Add task"
      does nothing or 500s. Root cause hidden the same way.
- [ ] **Terrible exception handling** (the umbrella pattern, expressed via the
      concrete cases below):
  - [ ] Empty `catch {}` blocks — e.g. delete silently "succeeds" in the UI but the
        row is still in the DB.
  - [ ] `200 OK` returned with an error payload on real failures (e.g. failed login
        returns `200 { error: "..." }` instead of `401`), so the UI shows success or a
        confusing state.
  - [ ] Raw, unformatted stack traces shown directly in the UI/API response on
        unexpected input, with no matching structured server-side log.

## Additional Basic, Testable Bugs

- [ ] **Broken profile update** — editing name/email/password silently no-ops or
      throws an uncaught error (mirrors the "can't create todo" pattern applied to
      profile edit).
- [ ] **Broken delete (FK constraint swallowed)** — deleting a `TodoList` that still
      has items throws a raw FK constraint violation that's caught and ignored;
      button shows success, list is still there on refresh.
- [ ] **Admin "create user" fails on duplicate email** — no pre-check, no friendly
      error; the unique-constraint violation is either swallowed (nothing happens,
      no user created, no message) or leaks a raw DB error to the screen.
- [ ] **Admin "Generate Password" button doesn't actually work** — button shows a
      generated password in the UI, but the handler never persists the new hash, so
      the "new" password never actually works at login.
- [ ] **Health check that always returns healthy** — `/api/health` hardcoded to
      `200 { status: "ok" }` without checking DB connectivity. Trivially testable:
      break the DB connection, hit `/api/health`, still see green.
- [ ] **Wrong/inconsistent HTTP status codes** — e.g. "not found" returns `500`
      instead of `404`, or a validation failure returns `500` instead of `400`.
      Easy to spot by watching the network tab while testing normal flows.
- [ ] **PII/secrets leaking into logs** — a debug log line dumps the full `user`
      object (including `passwordHash`) or the raw login request body (plaintext
      password) to stdout. Found by simply logging in once and reading the log
      output — no special setup needed.
- [ ] **Timezone-naive due dates** — a task's due date displays as the wrong day
      (off by one) because it's stored/compared without timezone normalization.
      Symptom is immediately visible: set "today" as due date, see "yesterday."
- [ ] **Client-side error boundary swallows errors** — triggering a broken UI state
      (e.g. editing a task with bad data) shows a generic "Something went wrong"
      screen, and nothing about it appears anywhere in the server logs.

---

## Cut from consideration (too complex / not testable by hand)

These require load, concurrency, elapsed time, or data volume to observe, so they're
out of scope per your note — kept here only as a record of what was considered and
rejected, not for future use:

- N+1 queries on the admin grid (needs hundreds of rows to matter)
- Unhandled promise rejection under load (needs concurrent traffic to crash the process)
- Unbounded in-memory cache / memory leak (needs hours of runtime)
- Connection pool exhaustion (needs concurrent load)
- Race condition in drag-to-reorder (needs simultaneous requests)
- Retry storm without backoff/jitter (needs a real outage to amplify)
- Missing DB index under growth (needs realistic data volume)
- Log flooding from verbose logging (needs sustained traffic)
- Missing/inconsistent correlation IDs (needs multi-request tracing understanding, not a functional break)
- Weak/hardcoded session secret (a code-review finding, not something you'd notice by using the app)

---

## Your additions

- [ ]
- [ ]

---

*Revised 2026-07-29: narrowed to bugs that are easy to spot while testing the app by
hand, hard to diagnose only because of missing/bad exception handling — no
concurrency, load, or time-dependent bugs.*
