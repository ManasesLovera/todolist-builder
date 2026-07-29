import { NextResponse } from "next/server";
import { requireRole, type SessionPayload } from "@/lib/auth";

/**
 * Shared guard for admin-only API routes (src/app/api/admin/**).
 *
 * `requireRole("ADMIN")` throws when there's no session at all or when the
 * session's role isn't ADMIN. Route handlers can't redirect like pages do,
 * so this normalizes both failure modes into a proper JSON error response:
 *   - no session at all               -> 401 Unauthorized
 *   - valid session, wrong role       -> 403 Forbidden
 *
 * Usage in a route handler:
 *
 *   const guard = await requireAdmin();
 *   if (!guard.ok) return guard.response;
 *   const session = guard.session;
 */
export type AdminGuardResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminGuardResult> {
  try {
    const session = await requireRole("ADMIN");
    return { ok: true, session };
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Forbidden: admin role required" },
          { status: 403 },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized: sign in required" },
        { status: 401 },
      ),
    };
  }
}
