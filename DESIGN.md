# DESIGN.md

## 0. Purpose

This application is a deliberately flawed Next.js ToDo list app used as a **training
target for observability, telemetry, and debugging**. It is not meant to be a good
example of application architecture — it is meant to *look* production-like on the
surface while containing realistic, diagnosable failures that only show up under real
usage. Trainees will use logs (via Fluent Bit) and dashboards (via Grafana) to find and
fix the issues listed in this document.

Nothing in this document should be read as "best practice." The bug catalog in Section
4 is the actual deliverable of the app.

---

## 1. Feature Roadmap & User Roles

### 1.1 Roles

- **`admin`** — full system access.
- **`member`** — scoped to their own profile and their own todo lists.

### 1.2 Member Features

- Login / authentication (email + password).
- View and edit own profile (name, email, password).
- Create, view, edit, delete, and organize multiple ToDo lists.
- Within a list: create, edit, complete, reorder, and delete ToDo items.

### 1.3 Admin Features

- All member capabilities, on the admin's own account.
- **User management**: list all users, create a user, delete a user, "Generate
  Password" button (server-generates and displays a temporary password).
- **Admin ToDo overview**: an Attio-style dynamic grid/view across *all* users' ToDo
  lists and items — filterable, sortable, inline-editable, with drag-to-reorder.

### 1.4 Rough Delivery Order

1. Auth (login, session handling) — includes Bug #1 (broken DB connection).
2. Profile CRUD.
3. ToDo list + item CRUD (member-scoped) — includes Bug #2 (broken task creation).
4. Admin user management.
5. Admin Attio-style grid view across all lists.
6. Bug catalog pass — deliberately (re-)introduce every item in Section 4 that isn't
   already covered by 1–5, with structured logging surrounding each one.
7. Observability stack (docker-compose: Next.js, PostgreSQL, Fluent Bit, Grafana).
8. Dashboards + training runbook (answer key, kept separate from this file).

---

## 2. Proposed Database Schema & ORM Models

ORM: Prisma (chosen for quick schema iteration and because its footguns — e.g. N+1
via lazy relation access, silent `upsert` misuse — are themselves useful training
material).

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(MEMBER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  lists        TodoList[]
}

enum Role {
  ADMIN
  MEMBER
}

model TodoList {
  id          String   @id @default(uuid())
  title       String
  description String?
  position    Int      @default(0)
  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  items       TodoItem[]
}

model TodoItem {
  id          String    @id @default(uuid())
  title       String
  isComplete  Boolean   @default(false)
  position    Int       @default(0)
  dueDate     DateTime?
  listId      String
  list        TodoList  @relation(fields: [listId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

Notes for the bug catalog (see Section 4):

- `position` fields on both `TodoList` and `TodoItem` exist specifically to support a
  reorder race condition (Bug #12).
- No `onDelete` cascade is specified on purpose — deleting a `User` or `TodoList` with
  children will throw a raw FK constraint violation, which is the trigger for Bug #2
  and part of Bug #5 (swallowed errors).

---

## 3. Observability Plan

```
Next.js app (stdout, JSON logs) → Fluent Bit (tail + parse) → Grafana (Loki datasource, dashboards/alerts)
                                                              ↘ Postgres (exposed via postgres_exporter, optional) → Grafana (Prometheus datasource)
```

- **Next.js**: all server-side logs written as single-line JSON to stdout (mix of
  well-formed and deliberately malformed/inconsistent shapes — see Bug catalog). A
  `requestId` is generated per request but only propagated through *some* code paths,
  intentionally, so trainees learn to notice when correlation breaks down.
- **Fluent Bit**: tails the Next.js container's stdout, parses JSON where possible,
  forwards to Loki (or directly to Grafana Cloud/local Loki instance) with container
  and route labels attached.
- **Grafana**: Loki datasource for logs, Prometheus datasource (via `postgres_exporter`
  and a small custom `/api/metrics` endpoint) for latency/error-rate/connection-pool
  metrics. Dashboards built in Task #7, after the app and bugs exist to generate real
  signal.
- Trace IDs / spans are explicitly **out of scope for Phase 1** — logs + metrics only,
  to keep the stack lightweight. Can be revisited (OpenTelemetry) as a later stretch
  goal once the log/metric pipeline is solid.

---

## 4. Catalog of Intentional Bugs & Anti-Patterns

Scope rule: every bug must be **easy to notice just by using the app** — login fails, a
button doesn't work, a value is wrong. The difficulty is entirely in **finding the root
cause**, because exception handling/logging is bad, not because the bug itself is
timing-dependent, load-dependent, or otherwise complex. Nothing below requires
concurrency, elapsed time, or data volume to reproduce. (The full working list, including
items considered and cut for being too complex, lives in `BUGS.md`.)

### 4.1 Required (from original brief)

| # | Bug | Mechanism |
|---|-----|-----------|
| 1 | Broken auth | Login fails due to wrong DB connection string / malformed Prisma client init (e.g. client instantiated per-request instead of singleton, or `DATABASE_URL` pointed at wrong port in one env). |
| 2 | Broken task creation | ORM misuse: `create()` called with a field that doesn't exist on the schema, or a required relation omitted, causing a Prisma validation error that isn't caught — or a unique constraint (e.g. duplicate `position`) that surfaces as a raw 500. |
| 3 | Terrible exception handling | Empty `catch {}` blocks (e.g. delete "succeeds" in the UI but the row is still in the DB), returning `200 OK` with an error payload on real server errors, raw stack traces sent to the client with no matching server-side structured log. |

### 4.2 Additional Basic, Testable Bugs

| # | Bug | Mechanism |
|---|-----|-----------|
| 4 | **Broken profile update** | Editing name/email/password silently no-ops or throws an uncaught error — same pattern as broken task creation, applied to profile edit. |
| 5 | **Broken delete (FK constraint swallowed)** | Deleting a `TodoList` that still has items throws a raw FK constraint violation that's caught and ignored; the UI shows success but the list is still there on refresh. |
| 6 | **Admin "create user" fails on duplicate email** | No pre-check; the unique-constraint violation is either swallowed (nothing happens, no message) or leaks a raw DB error to the screen. |
| 7 | **Admin "Generate Password" button doesn't work** | UI shows a generated password, but the handler never persists the new hash, so the "new" password never actually works at login. |
| 8 | **Health check that always returns healthy** | `/api/health` hardcoded to `return 200 { status: "ok" }` without checking DB connectivity. Trivially testable: break the DB, hit `/api/health`, still see green. |
| 9 | **Wrong/inconsistent HTTP status codes** | E.g. "not found" returns `500` instead of `404`, or a validation failure returns `500` instead of `400` — visible in the network tab during normal testing. |
| 10 | **PII/secrets leaking into logs** | A debug log line dumps the full `user` object (including `passwordHash`) or the raw login request body (plaintext password) to stdout — found just by logging in once and reading the logs. |
| 11 | **Timezone-naive due dates** | A task's due date displays off by one day because it's stored/compared without timezone normalization — set "today," see "yesterday." |
| 12 | **Client-side error boundary swallows errors** | Triggering a broken UI state shows a generic "Something went wrong" screen, with nothing about it appearing anywhere in the server logs. |

This is the working list — check it against `BUGS.md` (which also records what was cut
and why) and mark up any changes before the bug-injection phase (Task #4) begins.

---

## 5. Visual Identity & Design System

### 5.1 Color Palette & Tokens

The application UI uses a fresh, modern aesthetic built on light mint backgrounds, deep
forest green typography, and warm orange accents.

| Token | Hex Code | Role / Usage |
| :--- | :--- | :--- |
| `--bg-canvas` | `#F0FDF4` | App background (Soft Light Mint) |
| `--color-text-primary` | `#166534` | Headings, primary body text (Deep Forest Green) |
| `--color-text-secondary` | `#15803D` | Subtitles, labels, secondary body text |
| `--color-brand-primary` | `#EA580C` | Primary CTAs, active buttons (Vibrant Orange) |
| `--bg-surface` | `#FFFFFF` | Cards, panels, input surfaces |
| `--bg-accent-container` | `#A7F3D0` | Highlight panels, statistics containers |
| `--color-status-warning` | `#FBBF24` | Status badges, tags, pending indicators |
| `--border-subtle` | `#DCFCE7` | Structural borders, input outlines, table dividers |

### 5.2 Typography System

- **Primary Font Family:** Sans-serif (`Inter`, `System-UI`, or `Roboto`)
- **Monospace Font Family:** `Fira Code` / `JetBrains Mono` (for data views)

| Scale | Size / Line Height | Weight | Color | Target UI |
| :--- | :--- | :--- | :--- | :--- |
| **Display / H1** | `2.25rem` (36px) / `2.5rem` | Bold (`700`) | `--color-text-primary` | Main page titles, Hero headers |
| **Heading / H2** | `1.5rem` (24px) / `2rem` | SemiBold (`600`) | `--color-text-primary` | Section headers, card titles |
| **Subheading / H3** | `1.125rem` (18px) / `1.75rem` | Medium (`500`) | `--color-text-primary` | Modal headers, panel subtitles |
| **Body Large** | `1rem` (16px) / `1.5rem` | Regular (`400`) | `--color-text-primary` | Primary task text, inputs |
| **Body Small** | `0.875rem` (14px) / `1.25rem` | Regular (`400`) | `--color-text-secondary` | Metadata, timestamps, helper text |
| **Code / Mono** | `0.875rem` (14px) / `1.25rem` | Regular (`400`) | `--color-text-primary` | Inline raw data, system tags |

### 5.3 UI Components & Tokens

#### Cards & Surfaces

- **Background:** Surface White (`#FFFFFF`)
- **Border Radius:** `1rem` (`16px`)
- **Border:** `1px solid #DCFCE7`
- **Shadow:** Subtle soft drop shadow (`0 1px 3px 0 rgba(0, 0, 0, 0.05)`)

#### Buttons

- **Primary Button:**
  - Background: `#EA580C`
  - Text: `#FFFFFF` (Bold)
  - Border Radius: `0.75rem` (`12px`)
  - Padding: `0.75rem 1.5rem`
- **Secondary Button:**
  - Background: Transparent
  - Border: `1px solid #166534`
  - Text: `#166534`
  - Border Radius: `0.75rem` (`12px`)

#### Form Inputs

- **Background:** `#FFFFFF`
- **Border:** `1px solid #DCFCE7`
- **Focus State Border:** `2px solid #166534`
- **Border Radius:** `0.75rem` (`12px`)
- **Padding:** `0.75rem 1rem`

#### Badges & Tags

- **Border Radius:** `9999px` (Full pill shape)
- **Padding:** `0.25rem 0.75rem`
- **Default Variant:** Light Mint background (`#A7F3D0`), Deep Green text (`#166534`)
- **Warning Variant:** Soft Yellow background (`#FBBF24`), Dark Amber text (`#78350F`)

---

## 6. Layout Specifications

### 6.1 Screen Structure & Layout Grid

- **Global Canvas:** Fixed background color (`#F0FDF4`), minimum height `100vh`.
- **Top Navigation Bar:**
  - Height: `70px`
  - Background: `#FFFFFF` with bottom border (`#DCFCE7`)
  - Layout: Flexbox, space-between alignment (Logo on left, menu links center, user
    profile icon right).
- **Main Container:** Centered max-width (`1280px`), responsive side padding
  (`1.5rem`).

### 6.2 Screen Layout Specs

#### Authentication Screen (`/login`)

- Centered layout (vertical and horizontal centering).
- Single elevated card width: `420px`.
- Layout stack: Logo icon header → Title → Input Fields → Primary Action Button.

#### Member Dashboard Screen

- **Header Section:** Full-width hero title using H1 scale.
- **Grid Layout:** 3-column grid (`repeat(3, minmax(0, 1fr))`) for ToDo list cards.
- **Detail Split View:**
  - Left Column (`65%` width): Task list container with entry bar and interactive
    task rows.
  - Right Column (`35%` width): Metadata panel with `#A7F3D0` background surface card.

#### Admin Dashboard Screen

- **Overview Row:** 2-column stat cards with heavy padding (`2rem`) and large
  numerical indicators.
- **User Management Table:**
  - Full-width white surface card containing structured data grid.
  - Header row: Light green background (`#DCFCE7`), uppercase semi-bold text.
  - Row item dividers: `1px solid #DCFCE7`.
- **Attio-Style Dynamic Grid:**
  - Interactive table/board structure with custom inline editing indicators.
  - Drag handles: Subtle vertical dot icons (`#15803D`) on row hovers.
  - Column headers: Filter/sort icon triggers adjacent to title labels.

---

## 7. Open Questions for Feedback

1. Which of the 8 brainstormed bugs in Section 4.2 should be kept for v1 vs. deferred?
2. Is Prisma acceptable as the ORM, or is another ORM (Drizzle, TypeORM) preferred for
   different footgun characteristics?
3. Loki is assumed as the Grafana log datasource (fed by Fluent Bit) — confirm, or is
   plain file/stdout scraping without Loki preferred to keep the stack smaller?
4. Confirm trace IDs (OpenTelemetry) are out of scope for v1 as proposed in Section 3.
