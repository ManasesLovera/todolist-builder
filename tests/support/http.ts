/**
 * Shared HTTP-level test helpers for the present/fixed bug suites (see
 * TESTING.md and BUGS.md). These tests exercise a *running* instance of the
 * app (local `npm run dev`/`npm run start`, or the docker-compose stack)
 * purely over `fetch` -- no direct Prisma/DB access from the test process,
 * by design (see TESTING.md).
 *
 * Seeded credentials below come straight from prisma/seed.ts and must stay
 * in sync with it.
 */

export const BASE_URL = (
  process.env.TEST_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

export const SEEDED_ADMIN = {
  email: "admin@example.com",
  password: "password123",
};

export const SEEDED_MEMBER = {
  email: "member@example.com",
  password: "password123",
};

export function url(path: string): string {
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function authHeaders(cookie?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  return headers;
}

/**
 * Reads every `Set-Cookie` header off a fetch Response. Modern Node/undici
 * exposes `headers.getSetCookie()`; fall back to the single-value `.get()`
 * for older runtimes where only one combined/first value is available.
 */
export function getSetCookies(res: Response): string[] {
  const maybeMulti = res.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof maybeMulti.getSetCookie === "function") {
    return maybeMulti.getSetCookie();
  }
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

/** Returns the `session=<value>` pair (no attributes) if a session cookie was set. */
export function findSessionCookie(res: Response): string | null {
  const cookie = getSetCookies(res).find((c) => /^session=/.test(c));
  if (!cookie) return null;
  const pair = cookie.split(";")[0]?.trim();
  return pair && pair.length > "session=".length ? pair : null;
}

export type LoginResult = {
  res: Response;
  body: unknown;
  sessionCookie: string | null;
};

/** Raw login call -- does not assert anything, callers decide what "success" means. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  let body: unknown = null;
  try {
    body = await res.clone().json();
  } catch {
    // Non-JSON body is fine -- callers that care inspect `res` directly.
  }
  return { res, body, sessionCookie: findSessionCookie(res) };
}

/**
 * Logs in as one of the two seeded accounts and asserts it actually worked,
 * throwing a descriptive error (pointing at bug #1) if not. Several other
 * bug scenarios need *a* working session purely as setup, not as the thing
 * under test -- if bug #1 (broken auth) is present, login is blocked for
 * everyone and every one of those setup steps will fail with this message
 * instead of silently misreporting an unrelated bug as present/absent. See
 * TESTING.md's "cross-bug dependencies" note.
 */
async function loginAsSeeded(role: "admin" | "member"): Promise<string> {
  const creds = role === "admin" ? SEEDED_ADMIN : SEEDED_MEMBER;
  const { res, sessionCookie } = await login(creds.email, creds.password);
  if (!res.ok || !sessionCookie) {
    throw new Error(
      `Setup step failed: could not log in as the seeded ${role} account ` +
        `(${creds.email}) against ${BASE_URL} -- got HTTP ${res.status} and ` +
        `${sessionCookie ? "a" : "no"} session cookie. This test needs a working ` +
        `login purely as a precondition; if tests/present/01-broken-auth.test.ts ` +
        `is currently passing, bug #1 (broken auth) is present and blocking every ` +
        `test that needs a session. Fix bug #1 first, then re-run the rest of the suite.`,
    );
  }
  return sessionCookie;
}

export const loginAsAdmin = (): Promise<string> => loginAsSeeded("admin");
export const loginAsMember = (): Promise<string> => loginAsSeeded("member");

/**
 * Creates a disposable user via the admin API for tests that need to
 * destructively mutate an account (password changes, etc.) without touching
 * the shared seeded admin/member accounts other test files also log in as.
 */
export async function createThrowawayUser(
  adminCookie: string,
  role: "ADMIN" | "MEMBER" = "MEMBER",
): Promise<{ id: string; email: string; password: string }> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "TempPass1234!";
  const res = await fetch(url("/api/admin/users"), {
    method: "POST",
    headers: authHeaders(adminCookie),
    body: JSON.stringify({ name: "Test Fixture User", email, role, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Setup step failed: could not create a throwaway ${role} user via ` +
        `POST /api/admin/users (HTTP ${res.status}): ${text.slice(0, 300)}`,
    );
  }
  const body = (await res.json()) as { user: { id: string } };
  return { id: body.user.id, email, password };
}

/**
 * Ensures we have a TodoList with at least one item to operate on, for the
 * delete/FK-swallowed scenarios (#3a, #5).
 *
 * Tries the "normal" path first (create a fresh list + item through the
 * live API). If that fails -- most likely because bug #2 (broken task
 * creation) is currently present -- falls back to one of the two lists
 * prisma/seed.ts populates directly (bypassing the API), so this helper
 * still returns *something* with real items even when item creation is
 * broken. Give #3a and #5 different `seedFallbackTitle`s ("Groceries" /
 * "Work") so they don't fight over the same seeded list when both fall back
 * in the same run.
 */
export async function ensureListWithItems(
  cookie: string,
  seedFallbackTitle: "Groceries" | "Work",
): Promise<{ listId: string; itemCount: number; usedFallback: boolean }> {
  try {
    const createListRes = await fetch(url("/api/lists"), {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ title: `fixture-list-${seedFallbackTitle}-${Date.now()}` }),
    });
    if (createListRes.ok) {
      const { list } = (await createListRes.json()) as { list: { id: string } };
      const itemRes = await fetch(url(`/api/lists/${list.id}/items`), {
        method: "POST",
        headers: authHeaders(cookie),
        body: JSON.stringify({ title: `fixture-item-${Date.now()}` }),
      });
      if (itemRes.ok) {
        return { listId: list.id, itemCount: 1, usedFallback: false };
      }
    }
  } catch {
    // fall through to the seeded fallback below
  }

  const listsRes = await fetch(url("/api/lists"), { headers: authHeaders(cookie) });
  if (!listsRes.ok) {
    throw new Error(
      `Setup step failed: dynamic list/item creation didn't work and GET /api/lists ` +
        `also failed (HTTP ${listsRes.status}), so no seeded fallback could be found either.`,
    );
  }
  const { lists } = (await listsRes.json()) as {
    lists: { id: string; title: string; _count?: { items: number } }[];
  };
  const seeded = lists.find((l) => l.title === seedFallbackTitle);
  if (!seeded) {
    throw new Error(
      `Setup step failed: dynamic list/item creation didn't work (likely bug #2), and ` +
        `the seeded "${seedFallbackTitle}" list (from prisma/seed.ts) was not found for ` +
        `the current user. Make sure the DB has been seeded (npx prisma db seed) and ` +
        `hasn't already been consumed by a previous test run.`,
    );
  }
  const detailRes = await fetch(url(`/api/lists/${seeded.id}`), { headers: authHeaders(cookie) });
  const detailBody = detailRes.ok
    ? ((await detailRes.json()) as { list: { items: unknown[] } })
    : null;
  const itemCount = detailBody?.list?.items?.length ?? seeded._count?.items ?? 0;
  return { listId: seeded.id, itemCount, usedFallback: true };
}

/** Heuristics for "this response body looks like a raw, unformatted stack trace." */
export function looksLikeRawStackTrace(text: string): boolean {
  if (!text) return false;
  const signatures = [
    /at .+\(.*:\d+:\d+\)/, // "at Object.<anonymous> (/app/foo.js:12:34)"
    /\bnode_modules\b/,
    /PrismaClientKnownRequestError/,
    /PrismaClientValidationError/,
    /\.prisma[/\\]/,
    /\bat async\b/,
    /\bat Object\./,
    /Error:\s.+\n\s+at\s/, // "Error: message\n    at ..."
  ];
  return signatures.some((re) => re.test(text));
}

/** True if `text` parses as JSON shaped like a clean, friendly `{ error: "..." }` body. */
export function looksLikeCleanJsonError(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.error === "string" &&
      !looksLikeRawStackTrace(parsed.error)
    );
  } catch {
    return false;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" for a Date, using its *local* calendar date (not UTC). */
export function localDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
