# Grafana Dashboards

> [!IMPORTANT]
> These dashboards were **hand-written by reading the app's route source**
> (`src/app/api/**`), never exported from a running Grafana instance and never
> run against live Loki data — per the constraint on this task, the stack was
> not started, no container was run. Treat every query below as a
> **best-effort starting point**: once you actually bring the stack up
> (`docker compose up --build`), sanity-check field/label names in Grafana's
> Explore view against real Loki data before trusting a panel, and adjust
> queries if Fluent Bit's actual parsing differs from what's assumed here
> (see "Assumptions" below).

## Where things live

- `grafana/provisioning/dashboards/json/todolist-observability.json` — the one
  dashboard, "ToDoList App — Observability."
- `grafana/provisioning/datasources/datasources.yml` — pinned `uid: loki` was
  added (previously unset) so the dashboard JSON can reference the Loki
  datasource by a stable `uid` instead of an auto-generated one. This is the
  only non-dashboard file touched.

## Assumptions baked into every query (read this first)

- **Stream selector is always `{job="docker"}`.** Fluent Bit's `tail` input
  (`fluent-bit/fluent-bit.conf`) tails *every* container's json-file log, not
  just `web`'s — postgres, loki, grafana, and fluent-bit's own logs all land
  in Loki with the same two static labels (`job=docker`,
  `pipeline=fluent-bit`). The only per-container label is `filepath` (the
  tailed file path, keyed by a container ID assigned at `docker compose up`
  time) — not known ahead of time and not human-readable, so it's useless as
  a stable selector in committed dashboard JSON. Every query below instead
  narrows to the Next.js app's lines via `| json` field extraction (only the
  app's JSON lines have fields like `event`/`route`/`level`) or a line-content
  regex. This matches the reasoning already written into
  `fluent-bit/fluent-bit.conf`'s own comments.
- **`| json` parses the whole Loki line, which is itself a JSON envelope.**
  The `docker` parser (via Fluent Bit's `parser` filter) merges the app's
  parsed JSON fields (`level`, `event`, `route`, `userId`, `outcome`, `msg`,
  `error`, `timestamp`, etc.) onto the Docker envelope fields (`stream`,
  `time`, `filepath`, `log`) into one record, and the `loki` output's
  `Line_format json` re-serializes that whole merged record as the line Loki
  stores. So `| json` in LogQL should extract both the Docker-level fields
  (`stream`) and the app-level fields in one pass — **this is the single
  biggest unverified assumption in this whole file**, since it depends on
  Fluent Bit's exact merge/serialization behavior at runtime, not just on
  reading the static config.
- **Non-JSON lines (e.g. the Bug #10 PII line, described below) won't parse
  under `| json`** and are queried with line-content regex (`|~`) instead.

## Panels and what they're for

### 1. "How to use this dashboard" (text)

Orientation note repeating the stream-selector caveat above, and pointing at
this file for details.

### 2. Raw log stream (logs panel)

Everything from `{job="docker"}`, filterable via the `$search` textbox
variable (`|~ "$search"`, empty by default = show everything). This is the
starting point for any investigation — task requirement #1.
**Confidence: high** — it's the simplest possible query and doesn't depend on
field-extraction assumptions.

### 3. Error rate: structured errors vs stderr stream (time series)

Two series: `level="error"` JSON lines (everywhere the app calls
`console.error(JSON.stringify({level:"error", ...}))` — profile update, list
create/update, item update/delete, and most admin mutation failures) vs. any
line Docker tagged `stream="stderr"` (a superset that would also catch
uncaught runtime crashes, not just the app's own `console.error` calls).
**Confidence: medium** — depends on the `| json` merge assumption above, but
the underlying `level`/`stream` fields are directly confirmed in source
(`fluent-bit/parsers.conf`'s `docker` parser declares `stream`; every
`console.error` call I read uses `level: "error"`).

Gaps to know about: several bug-injected failure paths **never call
`console.error` at all** and won't show up in either series — see the
bug-by-bug table below.

### 4. Login attempts vs successful logins (time series)

Compares `|~ "Login attempt:"` line count (fires on every well-formed login
POST, success or fail — this line is Bug #10) against
`event="login_success"` count. The gap is an implicit failed-login rate.
**Confidence: high on the queries themselves** (both are directly copied from
route logic in `src/app/api/auth/login/route.ts`); **confidence: medium on
the diagnostic value**, because the gap also includes ordinary wrong-password
401s, not just Bug #1's DB failures — it's a proxy, not a precise Bug #1
counter. This is the closest thing to a Bug #1 signal, because Bug #1's own
catch block (`void error;`) logs nothing at all.

### 5. Log volume by event (bar gauge)

`sum by (event) (count_over_time(... | json | event=~".+" ...))` — task
requirement #3. **Confidence: high** on the field name and the specific event
strings (all copied verbatim from source: `login_success`, `list_created`,
`list_updated`, `list_deleted`, `item_updated`, `item_deleted`,
`profile_updated`, and the dotted `admin.*` events). Explicitly flagged in the
panel description: item **creation** (`POST /api/lists/[listId]/items`, Bug
#2) has no success-path logging at all, so it will never appear here
regardless of whether Bug #2 is present — its absence is not diagnostic by
itself.

### 6. Error volume by route/message (table)

`sum by (route, msg) (count_over_time(... | json | level="error" ...))` —
task requirement #3, error-flavored. Grouped by both `route` and `msg`
because several admin-route error logs (`admin.users.create failed`,
`admin.users.generatePassword failed`) omit the `route` field entirely.
**Confidence: high** on field presence per route (verified by reading every
route file), **confidence: medium** on exact LogQL grouping syntax/behavior
under real Loki.

### 7. "Bug #8 — /api/health is not the source of truth" (text)

Task requirement #4. States plainly that `/api/health` is hardcoded green
(`src/app/api/health/route.ts`, no DB check) and that this dashboard's
log-derived panels are the real signal, pointing at panels #4 and #8 for the
closest available proxy to real DB/auth health.

### 8. Best-effort DB/connection error search (logs panel)

`|~ "(?i)(econnrefused|5433|can't reach database|connection refused)"` —
an explicit guess at what the Postgres driver/Prisma engine might independently
write to stdout/stderr when Bug #1's broken client (pointed at port 5433)
fails to connect, since the app's own catch block logs nothing for that path.
**Confidence: low / speculative** — flagged as such in the panel description
and in the dashboard itself. Zero hits should be read as inconclusive, not as
"the DB is fine."

### 9. Bug #10 — PII/secrets leak demo (logs panel)

`|~ "(?i)password"` against `{job="docker"}`. **Confidence: high** — directly
matches `console.log("Login attempt:", body)` in
`src/app/api/auth/login/route.ts`, which dumps the raw request body including
the plaintext `password` field. Note in the panel: this specific line is
**not** valid JSON (it's `console.log` with two arguments, not a single
`JSON.stringify`'d string), so it won't be extracted by `| json` — it only
shows up via the line-content regex, which is intentional. I did not find any
other route in this codebase that logs `passwordHash` or a full user object,
so this is the only PII-leak source currently in the code.

### 10. Redaction alert template (text)

Task requirement #5's "template for a real log-redaction alert." Not a live
panel query — a markdown code block showing a LogQL pattern one would wire
into a real Grafana alert rule, with notes on what a production version would
add (route to a security channel, alert on `passwordHash` specifically since
that should *never* appear in logs regardless of Bug #10, etc.).

## Bug-by-bug: what's visible in logs vs. invisible by design

| # | Bug | Visible via this dashboard? |
|---|---|---|
| 1 | Broken auth (wrong DB port) | Indirectly — panel #4's attempt/success gap and panel #8's speculative search. The failure's own catch block logs nothing. |
| 2 | Broken task creation (`notes` field) | **Not visible.** Success path has no `console.log` at all; the error path returns a raw stack trace to the client but never calls `console.error`. Needs the browser network tab. |
| 3 | Terrible exception handling (umbrella) | Partially — panels #3/#6 catch the routes whose `catch` blocks DO call `console.error`. The empty-`catch{}` cases (list delete, admin user delete) and raw-stack-to-client cases (item creation, admin item update) log nothing and are invisible here. |
| 4 | Broken profile update (no-op) | `profile_updated` fires every time regardless (panel #5) — but that it fires proves nothing since it fires unconditionally; confirming no fields actually changed needs manual testing. |
| 5 | Broken delete, FK swallowed | **Not visible.** `list_deleted` logs unconditionally with `outcome: "success"` even when the delete silently failed — the log cannot be trusted at face value; only a DB check or UI refresh reveals it. |
| 6 | Admin create-user duplicate email | Visible — panel #6, `msg="admin.users.create failed"`. |
| 7 | Admin "generate password" doesn't persist | `admin.user.password_generated` fires every time regardless (panel #5) — same caveat as #4; the log alone can't tell you the new password doesn't work. |
| 8 | Health check always healthy | This whole dashboard is designed as the alternative source of truth — see panel #7. |
| 9 | Wrong/inconsistent HTTP status codes | **Mostly not visible.** These branches (item 404-as-500, reorder 400-as-500) return JSON directly with no `console.log`/`console.error` call at all — needs the network tab, not logs. |
| 10 | PII/secrets leaking into logs | Directly demoed — panel #9. |
| 11 | Timezone-naive due dates | **Not visible in logs** — `dueDate` is stored/returned as-is with no log line reflecting the timezone shift; needs UI inspection of entered-vs-displayed date. |
| 12 | Client-side error boundary swallows errors | **Not visible in logs, by definition** — it's a client-side-only failure with, per `BUGS.md`, nothing appearing "anywhere in the server logs." Good teaching moment for the client/server observability boundary. |

If a query needs adjusting once the stack is actually running (label names,
parser behavior, etc.), edit
`grafana/provisioning/dashboards/json/todolist-observability.json` directly —
Grafana's file-based dashboard provider (`grafana/provisioning/dashboards/dashboards.yml`,
`updateIntervalSeconds: 30`) will pick up changes automatically without a
restart.
