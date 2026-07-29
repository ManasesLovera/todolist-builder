import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

/**
 * /login — Authentication Screen (DESIGN.md Section 6.2).
 *
 * Centered layout, single elevated 420px card, logo -> title -> inputs ->
 * button stack. Full signature verification (getSession) happens here even
 * though middleware already does a lightweight cookie-presence redirect —
 * see src/middleware.ts for why the split exists.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-[calc(100vh-70px-4rem)] items-center justify-center">
      <div className="w-[420px] max-w-full rounded-card border border-border-subtle bg-surface p-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-container text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold leading-8 text-primary">
            ToDo<span className="text-brand-primary">List</span>
          </h1>
          <p className="text-sm leading-5 text-secondary">
            Sign in to manage your lists.
          </p>
        </div>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
