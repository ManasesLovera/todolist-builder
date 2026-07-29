# RUNBOOK.md — Training Answer Key

> **Audience**: instructors and trainees running the observability/debugging
> exercise described in `DESIGN.md`. This is the **reveal document** — kept
> deliberately separate from `BUGS.md` (the pre-fix checklist a trainee works
> from without spoilers). Do not hand this to trainees before the exercise;
> hand it out afterward, or use it to grade / unblock a stuck session.

## How to use this document

1. Bring up the stack per `OBSERVABILITY.md` (`docker compose up --build`,
   then run migrations/seed per `TESTING.md` section 1). This runbook does
   **not** verify any of the below by executing the app — everything here
   comes from reading source under `src/` and the existing tests under
   `tests/present/` and `tests/fixed/`.
2. Use the app by hand — try to log in, add a task, delete a list, generate
   an admin password, etc. — and let each bug announce itself as a visible
   failure (per the "Scope rule" in `DESIGN.md`/`BUGS.md`: every bug is easy
   to *notice*, hard to *diagnose*).
3. For each suspected bug:
   - Check Grafana **Explore** against the Loki datasource (see
     `OBSERVABILITY.md`) for the log signal named in that bug's "Where to
     look" section below, or tail `docker compose logs -f web` directly if
     Grafana dashboards aren't built yet (see the Grafana note below).
   - Run `npx vitest run tests/present/NN-*.test.ts` — it should **pass**,
     confirming the buggy behavior is present and you've found the right bug.
   - Read the "Root cause" section here, then go fix it in the file/line
     indicated.
   - Run `npx vitest run tests/fixed/NN-*.test.ts` — it should now **pass**
     (it fails against the unfixed app; it's the acceptance test for that
     bug).
4. Two bugs (#10 PII-in-logs, #12 client error boundary) can't be verified
   purely over HTTP — their `tests/present`/`tests/fixed` files are
   `test.skip` stubs with manual verification steps inline. Confirm those by
   hand (reading raw stdout for #10, using the browser for #12).

### Note on Grafana cross-references

As of this writing, `grafana/provisioning/dashboards/json/` contains only a
`.gitkeep` — **no dashboard JSON exists yet**, and there is no
`grafana/DASHBOARDS.md` file. Dashboard panels are deferred to a later phase
per `OBSERVABILITY.md` ("Dashboards are a placeholder"). Every "Where to
look" section below therefore references the **Loki log event/field names**
(confirmed from the actual `console.log`/`console.error` call sites) and the
generic Fluent Bit → Loki → Grafana Explore path from `OBSERVABILITY.md`,
rather than named dashboard panels. **Once the Grafana dashboards agent
lands, this document needs a follow-up pass** to add specific
dashboard/panel names per bug.

---

## Summary table

| # | Bug | Primary file | One-line fix |
|---|-----|-------------|---------------|
| 1 | Broken auth | `src/app/api/auth/login/route.ts` | Delete the route-local `PrismaClient`/`PrismaPg` adapter pointed at port 5433; use the shared `prisma` singleton from `@/lib/prisma`. |
| 2 | Broken task creation | `src/app/api/lists/[listId]/items/route.ts` | Remove the `notes: parsed.data.title` field from the `create()` call (not a schema field). |
| 3a | Empty catch swallows delete | `src/app/api/lists/[listId]/route.ts` (`DELETE`) | Delete list items first inside a transaction (mirror `src/app/api/admin/users/[id]/route.ts`), stop swallowing the catch, and return a real error status on failure. |
| 3b | 200 OK with error payload | `src/app/api/auth/login/route.ts` (login catch) | Log the DB error and return a 5xx (e.g. 503) instead of `{ status: 200 }`. |
| 3c | Raw stack trace leaked | `src/app/api/lists/[listId]/items/route.ts`, `src/app/api/admin/todos/items/[id]/route.ts` | Log the error server-side as structured JSON; return a generic message with no `stack`/`String(error)` in the response body. |
| 4 | Broken profile update | `src/app/api/profile/route.ts` | Pass the built-up `data` object into `prisma.user.update({ data })` instead of `data: {}`. |
| 5 | Broken delete (FK swallowed) | `src/app/api/lists/[listId]/route.ts` (`DELETE`) | Delete child `TodoItem`s in a transaction before deleting the `TodoList` (same fix as 3a — one root cause, two symptoms). |
| 6 | Admin create-user duplicate email | `src/app/api/admin/users/route.ts` (`POST`) | Add a pre-check (`findUnique` by email) or catch Prisma `P2002` specifically and return `400 { error: "Email already in use" }`. |
| 7 | Admin generate-password doesn't persist | `src/app/api/admin/users/[id]/generate-password/route.ts` | Include `passwordHash` in the `prisma.user.update({ data: { ... } })` call instead of only `updatedAt`. |
| 8 | Health check always healthy | `src/app/api/health/route.ts` | Add a real DB check (e.g. `await prisma.$queryRaw\`SELECT 1\`` in a try/catch) and return 503 on failure. |
| 9 | Wrong/inconsistent HTTP status codes | `src/app/api/lists/[listId]/items/[itemId]/route.ts` (`loadOwnedItem`); `src/app/api/admin/todos/lists/[id]/reorder/route.ts` | Return `404` for missing item (not 500); return `400` for the stale/foreign-id validation failure (not 500). |
| 10 | PII/secrets in logs | `src/app/api/auth/login/route.ts` | Remove `console.log("Login attempt:", body)`, or redact `password` before logging. |
| 11 | Timezone-naive due dates | `src/components/lists/list-detail.tsx` (write path line ~54, read path line ~340) | Parse/format the date-only string consistently — e.g. treat as local calendar date on both write and read, or store/display in UTC consistently instead of mixing `new Date("YYYY-MM-DD")` (UTC midnight) with `toLocaleDateString()` (local tz). |
| 12 | Client error boundary swallows errors | `src/app/lists/[listId]/error.tsx` | In the error boundary, log the error (e.g. `console.error` or POST to a reporting endpoint) instead of discarding it silently. |

---

## Bug #1 — Broken auth

**Anti-pattern category**: broken DB/ORM usage (bad client instantiation).

- **Symptom**: Login always fails (per `BUGS.md`: "login always fails/500s").
  Since the failure path here actually returns `200` (see Bug #3b, same
  route), the trainee-visible symptom is more precisely: login never
  succeeds and shows a generic "Something went wrong" message, with the
  network tab showing a *misleading* `200` status.
- **Where to look**: This route (`src/app/api/auth/login/route.ts`) has
  **no structured log at all** on the DB-failure path — the catch block at
  line 55 discards the error (`void error;`) without logging, which is
  itself part of the bug (root cause is meant to be hidden). The only
  structured log emitted by this route is `event: "login_success"` on the
  happy path, so its *absence* for a given attempt is the log-side signal
  to look for in Loki/Fluent Bit output (generic Loki Explore query per
  `OBSERVABILITY.md`, since no dashboard panel exists yet — see Grafana note
  above). Confirmed by `tests/present/01-broken-auth.test.ts`, which asserts
  login fails for valid seeded credentials.
- **Root cause**: `src/app/api/auth/login/route.ts` lines 42–50 —
  instantiates its own `PrismaPg` adapter + `PrismaClient` pointed at
  `postgresql://todolist:todolist@localhost:5433/todolist` (port **5433**),
  instead of importing the shared `prisma` singleton from `@/lib/prisma`
  (which correctly uses `DATABASE_URL`, port 5432 per `docker-compose.yml`).
  Every other route imports the shared singleton and works fine — only this
  route is broken. Since the app hasn't been run, the exact connection-error
  text (e.g. `ECONNREFUSED`) is not verified here, only inferred from the
  wrong port.
- **The fix**: Delete the local `brokenAdapter`/`brokenPrisma`
  instantiation (lines 42–50) and use the imported `prisma` singleton from
  `@/lib/prisma` for the `user.findUnique` call instead.

---

## Bug #2 — Broken task creation

**Anti-pattern category**: broken DB/ORM usage (unknown-field validation
error).

- **Symptom**: "Add task" in a list's detail view always fails (per
  `BUGS.md`: "does nothing or 500s").
- **Where to look**: No `console.log`/`console.error` is emitted on this
  failure path at all (that's the point of Bug #3c below, co-located in the
  same catch block) — so there's nothing to find in Loki for this one; the
  only place the real error is visible is the raw JSON response in the
  browser network tab (`error`/`stack` fields — see Bug #3c). Confirmed by
  `tests/present/02-broken-task-creation.test.ts`.
- **Root cause**: `src/app/api/lists/[listId]/items/route.ts` lines 53–65 —
  the `prisma.todoItem.create()` call includes `notes: parsed.data.title`,
  and `notes` is not a field on the `TodoItem` model (see
  `prisma/schema.prisma` / `DESIGN.md` section 2 schema). Prisma throws a
  validation error on every call.
- **The fix**: Remove the `notes: parsed.data.title` line from the `data`
  object passed to `create()`.

---

## Bug #3a — Empty catch swallows delete (list delete)

**Anti-pattern category**: terrible exception handling (empty `catch {}`).

- **Symptom**: Deleting a non-empty `TodoList` appears to succeed in the UI
  (list navigates away, no error shown) but the list is still present on
  refresh.
- **Where to look**: `src/app/api/lists/[listId]/route.ts`'s `DELETE`
  handler unconditionally logs `event: "list_deleted"` with
  `outcome: "success"` **regardless of whether the delete actually
  happened** — this is the specific signal to distrust: a `list_deleted`
  log entry does not reliably mean the row is gone (per the code comment at
  line 159). Cross-check against `tests/present/03a-empty-catch-swallowed-delete.test.ts`,
  which deletes a non-empty list and then re-fetches it to prove it's still
  there.
- **Root cause**: `src/app/api/lists/[listId]/route.ts` lines 142–157 —
  `prisma.todoList.delete()` is called directly with no prior deletion of
  child `TodoItem` rows. Since the schema has no `onDelete` cascade
  (`DESIGN.md` section 2), this throws a real FK constraint violation every
  time the list has items. The `catch {}` block (lines 150–157) is
  intentionally empty — the violation is discarded, and execution falls
  through to the unconditional `204` success response.
- **The fix**: Wrap the deletion in a `prisma.$transaction` that first
  `deleteMany`s the list's `TodoItem`s, then deletes the `TodoList` itself
  (mirror the pattern already used correctly in
  `src/app/api/admin/users/[id]/route.ts` lines 43–56). Also stop
  swallowing errors: if the transaction still throws for some other reason,
  log it and return a real error status instead of falling through to
  `204`.

---

## Bug #3b — 200 OK with error payload (login)

**Anti-pattern category**: terrible exception handling (wrong success
status on failure).

- **Symptom**: When the DB call fails during login, the client-side
  `fetch` sees `response.ok === true` (status 200) even though the login
  did not succeed — any UI code trusting `response.ok` would show a false
  "success" state or a confusing in-between state rather than a clear
  error.
- **Where to look**: Same route as Bug #1 — no log is emitted on this path
  (see Bug #1's "Where to look"); the signal here is purely in the HTTP
  response status/body, not the logs. Confirmed in
  `tests/present/03b-200-with-error-payload.test.ts`.
- **Root cause**: `src/app/api/auth/login/route.ts` lines 52–68 — the
  `catch (error)` around `brokenPrisma.user.findUnique()` returns
  `NextResponse.json({ error: "..." }, { status: 200 })` instead of a 5xx.
- **The fix**: Return a `5xx` status (e.g. `503` for a downstream DB
  failure) from this catch block, and add a structured server-side log
  (e.g. `event: "login_error"`, no PII) so the failure is diagnosable — this
  pairs naturally with fixing Bug #1's connection itself.

---

## Bug #3c — Raw stack trace leaked to client

**Anti-pattern category**: terrible exception handling (leaking
internals / missing server-side log).

- **Symptom**: On task creation failure (Bug #2) and on admin grid
  inline-edit failure, the browser network tab shows a raw
  `{ error: "...", stack: "..." }` payload with a full JS stack trace,
  instead of a clean message.
- **Where to look**: Neither of the two call sites below writes a
  server-side `console.log`/`console.error` on this path — that's the bug.
  There is nothing to find in Loki for these failures; the only place the
  error is visible is the HTTP response body itself. Confirmed by
  `tests/present/03c-raw-stack-trace-leaked.test.ts` (a best-effort probe
  across both plausible trigger points, per the note in `TESTING.md`).
- **Root cause**: Two call sites do this:
  - `src/app/api/lists/[listId]/items/route.ts` lines 68–80 (task creation
    catch block).
  - `src/app/api/admin/todos/items/[id]/route.ts` lines 84–95 (admin grid
    item PATCH catch block).
  Both return `{ error: String(error), stack: error instanceof Error ? error.stack : undefined }`
  with `status: 500` and no accompanying `console.error`.
- **The fix**: In both locations, add a structured `console.error(JSON.stringify({...}))`
  log (matching the pattern already used elsewhere in the same files, e.g.
  `src/app/api/lists/[listId]/items/[itemId]/route.ts` lines 98–109) and
  return a generic client-facing message with **no** `error`/`stack` raw
  detail.

---

## Bug #4 — Broken profile update

**Anti-pattern category**: broken DB/ORM usage (silent no-op update).

- **Symptom**: Editing name/email/password on the profile page shows a
  success response, but none of the fields actually change when you reload.
- **Where to look**: `src/app/api/profile/route.ts` emits
  `event: "profile_updated"` with `outcome: "success"` on **every** call
  that doesn't throw — including this no-op case (per the code comment at
  line 129) — so, like Bug #3a, the presence of this log entry does not
  prove the row changed. Confirmed by `tests/present/04-broken-profile-update.test.ts`,
  which PATCHes a field and then re-fetches to show it didn't persist.
- **Root cause**: `src/app/api/profile/route.ts` lines 65–76 — the `data`
  object is correctly built up from `name`/`email`/`passwordHash` above
  (lines 38–63), but the actual `prisma.user.update()` call passes
  `data: {}` (hardcoded empty object) instead of the built `data` variable;
  `void data;` on line 76 marks it deliberately unused.
- **The fix**: Change `data: {}` to `data` (i.e. pass the already-built
  object) in the `prisma.user.update()` call.

---

## Bug #5 — Broken delete (FK constraint swallowed)

**Anti-pattern category**: broken DB/ORM usage + empty catch (same root
mechanism as Bug #3a — documented separately here per `BUGS.md`/`TESTING.md`
numbering, but it is literally the same code fix).

- **Symptom**: Same as Bug #3a: deleting a `TodoList` with items appears
  to succeed but the list persists in the DB.
- **Where to look**: Same as Bug #3a — the `list_deleted` log entry fires
  unconditionally regardless of actual deletion outcome (see
  `src/app/api/lists/[listId]/route.ts` lines 159–172). Confirmed by
  `tests/present/05-broken-delete-fk-swallowed.test.ts`, which (per
  `TESTING.md`) falls back to the pre-seeded "Groceries"/"Work" lists (which
  already have items) if dynamic item creation is still broken by Bug #2.
- **Root cause**: Identical to Bug #3a — `src/app/api/lists/[listId]/route.ts`
  lines 142–157: no child-item cleanup before `todoList.delete()`, FK
  violation swallowed by an empty `catch {}`.
- **The fix**: Same fix as Bug #3a — delete child items in a transaction
  before deleting the list, and stop swallowing the catch.

---

## Bug #6 — Admin "create user" fails on duplicate email

**Anti-pattern category**: broken DB/ORM usage (unhandled unique
constraint) / wrong status code.

- **Symptom**: Creating a user with an email that already exists produces a
  generic 500 error in the admin UI with no indication the email was the
  problem (per `BUGS.md`: "no message" or a raw DB error).
- **Where to look**: `src/app/api/admin/users/route.ts` logs
  `msg: "admin.users.create failed"` with `level: "error"` and the raw
  Prisma error message on this path (lines 74–80) — this is a real,
  findable log entry (unlike some of the other bugs), but it's generic and
  doesn't surface a friendly reason to the caller. Confirmed by
  `tests/present/06-admin-create-user-duplicate-email.test.ts`.
- **Root cause**: `src/app/api/admin/users/route.ts` lines 43–61 — no
  pre-check for an existing email, and the `catch` block (lines 73–85) has
  no special-case handling for Prisma's `P2002` unique-constraint error
  code; it falls into the generic `500 { error: "Failed to create user" }`
  response for every failure type.
- **The fix**: Either add a `prisma.user.findUnique({ where: { email } })`
  pre-check before `create()` and return `400` with a clear message if
  found, or catch `P2002` specifically in the existing catch block (same
  pattern already used correctly in `src/app/api/profile/route.ts` lines
  78–88) and map it to `400 { error: "That email is already in use." }`.

---

## Bug #7 — Admin "Generate Password" button doesn't work

**Anti-pattern category**: broken DB/ORM usage (computed value never
persisted).

- **Symptom**: Clicking "Generate Password" for a user shows a new
  temporary password in the admin UI, but that password does not actually
  work if you try to log in as that user with it.
- **Where to look**: `src/app/api/admin/users/[id]/generate-password/route.ts`
  logs `event: "admin.user.password_generated"` with `outcome: "success"`
  unconditionally on the happy path (lines 59–68) — this log fires every
  time regardless of whether the hash was actually saved, so its presence
  is not proof the password changed (same "log lies" pattern as Bugs
  #3a/#4/#5). Confirmed by `tests/present/07-admin-generate-password-not-persisted.test.ts`,
  which generates a password then attempts to log in with it and expects
  failure.
- **Root cause**: `src/app/api/admin/users/[id]/generate-password/route.ts`
  lines 30–43 — `passwordHash` is computed via `bcrypt.hash()` (line 32,
  flagged unused via an eslint-disable comment) but the subsequent
  `prisma.user.update()` call only sets `updatedAt: new Date()` — it never
  includes `passwordHash` in its `data`.
- **The fix**: Add `passwordHash` to the `data` object in the
  `prisma.user.update()` call (line 40–43) so the freshly generated hash is
  actually persisted.

---

## Bug #8 — Health check always returns healthy

**Anti-pattern category**: wrong status code / fake liveness signal (no
real dependency check).

- **Symptom**: `/api/health` returns `200 { status: "ok" }` even when the
  DB connection is completely broken and every other route is failing.
- **Where to look**: There is no log emitted by this route at all — it's a
  two-line handler. The signal to look for isn't a log line, it's the
  *contradiction* between this endpoint's `200` and errors appearing
  elsewhere (e.g. login failures per Bug #1, or DB-error logs from other
  routes) at the same time — that mismatch is the whole point of the bug.
  Confirmed by `tests/present/08-health-check-always-healthy.test.ts`.
- **Root cause**: `src/app/api/health/route.ts` lines 11–13 — the handler
  is a hardcoded `return NextResponse.json({ status: "ok" })` with no
  Prisma call of any kind.
- **The fix**: Add an actual DB connectivity check, e.g.
  `await prisma.$queryRaw\`SELECT 1\`` inside a try/catch; return `200 { status: "ok" }`
  only if it succeeds, and `503 { status: "error" }` (or similar) if it
  throws.

---

## Bug #9 — Wrong/inconsistent HTTP status codes

**Anti-pattern category**: wrong status code.

- **Symptom**: Two distinct places where a client-side validation problem
  is reported as a server error (`500`) in the network tab instead of the
  correct `4xx`:
  1. PATCH/DELETE against a stale or bogus `itemId` shows `500` instead of
     `404`.
  2. Drag-to-reorder in the admin grid with stale/foreign item ids shows
     `500` instead of `400`.
- **Where to look**: Neither site logs anything distinguishing — the first
  site (`loadOwnedItem`) doesn't log at all on this branch; the second logs
  only on the DB-transaction failure path, not on this validation branch.
  The signal is purely the HTTP status code shown in the browser network
  tab / any log line recording `event`/response status for these routes.
  Confirmed by `tests/present/09-wrong-http-status-codes.test.ts` (a
  best-effort probe across both trigger points, per `TESTING.md`).
- **Root cause**:
  - `src/app/api/lists/[listId]/items/[itemId]/route.ts` lines 23–29 —
    `loadOwnedItem()` returns `{ status: 500, error: "Item not found." }`
    when the item doesn't exist or doesn't belong to the given list; this
    should be a `404`.
  - `src/app/api/admin/todos/lists/[id]/reorder/route.ts` lines 63–75 —
    the "same set" validation failure (client sent a mismatched set of item
    ids) returns `status: 500`; this is a client input problem and should
    be `400`.
- **The fix**: Change the `500` in `loadOwnedItem` (line 28) to `404`.
  Change the `500` in the reorder route's `sameSet` check (line 73) to
  `400`.

---

## Bug #10 — PII/secrets leaking into logs

**Anti-pattern category**: PII/secrets leak in logs.

- **Symptom**: Not visible in the UI at all — only found by reading raw
  server stdout/log output after a single login attempt (per `BUGS.md`:
  "found by simply logging in once and reading the log output"). This is
  why `tests/present/10-pii-secrets-in-logs.test.ts` and
  `tests/fixed/10-pii-secrets-in-logs.test.ts` are both `test.skip` stubs —
  it can't be asserted purely via HTTP responses; it requires reading
  actual log output (manual verification, or grepping `docker compose logs
  web` / Loki for the raw request body).
- **Where to look**: `src/app/api/auth/login/route.ts` line 40:
  `console.log("Login attempt:", body)` — a plain (non-JSON-structured)
  log line, distinct from the well-formed JSON logs elsewhere in the same
  file, that dumps the entire parsed request body — including the
  plaintext `password` field — to stdout on every login attempt. In Loki
  this would show up as an unstructured line containing `"Login attempt:"`
  followed by the raw JSON body, rather than one of the app's normal
  `{"level":...,"event":...}` structured entries.
- **Root cause**: `src/app/api/auth/login/route.ts` line 40 — the debug
  `console.log` call logs the full `body` object (email + plaintext
  password) with no redaction.
- **The fix**: Remove the line entirely, or replace it with a redacted
  structured log that logs only non-sensitive fields (e.g. `email`, never
  `password`).

---

## Bug #11 — Timezone-naive due dates

**Anti-pattern category**: data correctness bug from inconsistent
timezone handling (not exception handling, but same "silently wrong,
nothing logged" family).

- **Symptom**: Setting a task's due date to "today" (via the date input)
  and viewing it back shows "yesterday" for any user in a timezone behind
  UTC.
- **Where to look**: This bug produces no error and no log signal at all —
  it's a pure rendering/storage mismatch, not a caught exception. There is
  nothing to find in Loki/Grafana for this one; it's diagnosed purely by
  comparing the date typed into the UI against the date rendered back, and
  then reading the two code paths below. Confirmed by
  `tests/present/11-timezone-naive-due-dates.test.ts`.
- **Root cause**: `src/components/lists/list-detail.tsx`:
  - Write path, line ~54 (`handleAddItem`): `new Date(newDueDate).toISOString()`
    where `newDueDate` is a bare `"YYYY-MM-DD"` string from the `<input type="date">`.
    Per the ECMA-262 date-string spec, a date-only string parses as **UTC
    midnight**, not local midnight.
  - Read path, line ~340 (`TaskRow`): `new Date(item.dueDate).toLocaleDateString()`
    formats that stored UTC-midnight instant using the **browser's local**
    timezone.
  - Combined: for any timezone behind UTC (e.g. US timezones), a date
    entered as "today" is stored as UTC midnight of that day, which is
    still "yesterday evening" in local time, and renders back one day
    earlier.
- **The fix**: Make the write and read paths agree on a single
  interpretation — e.g. keep the date-only string as a calendar date
  (parse/format using UTC consistently on both ends, or use a date-only
  library/util instead of `Date` + `toLocaleDateString()`), so what's typed
  in matches what's displayed regardless of the viewer's local timezone.

---

## Bug #12 — Client-side error boundary swallows errors

**Anti-pattern category**: empty catch / swallowed error, expressed as a
React error boundary instead of a try/catch.

- **Symptom**: Triggering a broken UI state under `/lists/[listId]` (e.g.
  editing a task into a bad state that throws during render) shows a
  generic "Something went wrong" screen with a "Please try again later"
  message, and this event never shows up anywhere in the server-side logs.
- **Where to look**: Because this is a client-only React error boundary,
  it produces **zero** server-side log signal — nothing in Loki/Fluent Bit
  will ever show this failure, which is the entire point of the bug (per
  `BUGS.md`: "nothing about it appears anywhere in the server logs"). It
  can only be observed via the browser (React DevTools / browser console),
  which is why `tests/present/12-client-error-boundary-swallows-errors.test.ts`
  and its `tests/fixed` counterpart are both `test.skip` manual-verification
  stubs.
- **Root cause**: `src/app/lists/[listId]/error.tsx` lines 10–28 — this is
  the Next.js `error.tsx` boundary for the `/lists/[listId]` segment. It
  receives `error` as a prop but immediately discards it (`void error;` on
  line 16) — no `console.error`, no call to any reporting endpoint.
- **The fix**: In the error boundary component, log the caught error (at
  minimum `console.error` with a structured payload including `error.message`
  and `error.digest`), and/or POST it to a client-error-reporting API route
  so it becomes visible in server logs / Loki.

---

*This document reflects source-reading only — no bug's runtime behavior
(exact error text, exact log line ordering, screenshots) was verified by
executing the app, per the task constraint. Anywhere a claim depends on
actually running the stack, it's flagged inline above as inferred rather
than confirmed.*
