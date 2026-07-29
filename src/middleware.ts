import { NextResponse, type NextRequest } from "next/server";

// Duplicated literal (must match SESSION_COOKIE_NAME in @/lib/auth) rather than
// imported: importing from auth.ts would pull its `node:crypto` usage into this
// Edge Runtime bundle, which doesn't reliably support Node builtins.
const SESSION_COOKIE_NAME = "session";

/**
 * Route protection.
 *
 * AUTH-CHECK SPLIT (documented per task instructions):
 * Middleware runs on Next's Edge runtime, where `sign()`/`decodeSession()` in
 * src/lib/auth.ts (which use Node's `crypto.createHmac`) are not guaranteed
 * to run. Rather than depend on Node APIs being available at the edge, this
 * middleware only checks for the *presence* of the session cookie:
 *   - no cookie -> bounce to /login (can't possibly be authenticated)
 *   - cookie present + visiting /login -> bounce to / (looks logged in)
 * That's enough to keep anonymous users off protected pages and keep logged
 * -in-looking users off the login screen with a cheap, edge-safe check.
 *
 * The actual signature verification happens downstream, in the Node.js
 * runtime: every protected server page calls `getSession()` (see
 * src/app/page.tsx, src/app/profile/page.tsx, src/app/lists/[listId]/page.tsx)
 * and every API route calls `getSession()`/`requireSession()` (see
 * src/app/api/**). A forged or tampered cookie value will pass this
 * middleware's presence check but fail HMAC verification there and be
 * treated as unauthenticated (redirect / 401), so security never actually
 * rests on this file alone — it's a UX-level fast path, not the auth
 * boundary.
 *
 * API routes are intentionally excluded from the matcher below: an
 * unauthenticated fetch to /api/** should get back a JSON 401 with a real
 * error message (produced by the route handler), not an HTML redirect.
 */
export function middleware(request: NextRequest) {
  const hasSessionCookie = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    if (hasSessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
