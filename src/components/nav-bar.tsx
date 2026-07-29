import Link from "next/link";
import { getSession } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";

/**
 * Top navigation bar per DESIGN.md Section 6.1.
 *
 * - Height: 70px
 * - Background: #FFFFFF with bottom border #DCFCE7
 * - Layout: flex, space-between (logo left, menu center, user icon right)
 *
 * Async server component: reads the session once per request via
 * getSession() (full HMAC verification, not just cookie presence — see
 * src/middleware.ts for why that split exists) so the center menu and the
 * user icon only render when there's a verified session. The Admin link is
 * gated on session.role === "ADMIN" but this file does not build or import
 * anything under src/app/admin/** — that's a separate workstream.
 */
export async function NavBar() {
  const session = await getSession();

  return (
    <header className="h-nav w-full border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-full max-w-container items-center justify-between px-6">
        {/* Left: logo */}
        <Link href="/" className="text-lg font-semibold text-primary">
          ToDo<span className="text-brand-primary">List</span>
        </Link>

        {/* Center: menu */}
        <nav className="hidden flex-1 items-center justify-center gap-6 sm:flex">
          {session ? (
            <>
              <Link
                href="/"
                className="text-sm font-medium text-secondary transition-colors hover:text-primary"
              >
                Dashboard
              </Link>
              <Link
                href="/profile"
                className="text-sm font-medium text-secondary transition-colors hover:text-primary"
              >
                Profile
              </Link>
              {session.role === "ADMIN" ? (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-secondary transition-colors hover:text-primary"
                >
                  Admin
                </Link>
              ) : null}
            </>
          ) : null}
        </nav>

        {/* Right: user menu */}
        {session ? (
          <UserMenu email={session.email} />
        ) : (
          <div className="h-9 w-9" aria-hidden="true" />
        )}
      </div>
    </header>
  );
}
