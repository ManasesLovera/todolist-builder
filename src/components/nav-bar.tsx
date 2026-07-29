import Link from "next/link";

/**
 * Top navigation bar per DESIGN.md Section 6.1.
 *
 * - Height: 70px
 * - Background: #FFFFFF with bottom border #DCFCE7
 * - Layout: flex, space-between (logo left, menu center, user icon right)
 *
 * This is scaffold only — the center menu and right-hand user icon are
 * placeholders. Auth/session-aware content is wired up in a later phase.
 */
export function NavBar() {
  return (
    <header className="h-nav w-full border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-full max-w-container items-center justify-between px-6">
        {/* Left: logo */}
        <Link
          href="/"
          className="text-lg font-semibold text-primary"
        >
          ToDo<span className="text-brand-primary">List</span>
        </Link>

        {/* Center: menu placeholder (populated once routes exist) */}
        <nav className="hidden flex-1 items-center justify-center gap-6 sm:flex" />

        {/* Right: user profile icon placeholder */}
        <div
          aria-label="User menu placeholder"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-container text-sm font-medium text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5Z" />
          </svg>
        </div>
      </div>
    </header>
  );
}
