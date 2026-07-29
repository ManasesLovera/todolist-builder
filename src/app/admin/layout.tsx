import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

/**
 * Shared layout for everything under /admin. Gates the entire section on a
 * valid ADMIN session — requireRole("ADMIN") throws if there's no session
 * (not logged in) or the session role isn't ADMIN, and in both cases we
 * redirect to /login rather than let the page render or crash.
 *
 * Individual admin pages also call requireRole("ADMIN") themselves as a
 * defense-in-depth measure (cheap — just re-reads/verifies the session
 * cookie), so this section stays safe even if a page is ever rendered
 * outside this layout.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-4xl font-bold leading-[2.5rem] text-primary">
          Admin
        </h1>
        <nav className="mt-4 flex gap-2 border-b border-border-subtle">
          <AdminTab href="/admin" label="Overview" />
          <AdminTab href="/admin/users" label="Users" />
          <AdminTab href="/admin/todos" label="ToDo Grid" />
        </nav>
      </div>
      {children}
    </div>
  );
}

function AdminTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-t-control px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-accent-container hover:text-primary"
    >
      {label}
    </Link>
  );
}
