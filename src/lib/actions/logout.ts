"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

/**
 * Server action that clears the session cookie and redirects to /login.
 * Exported as a server action (rather than a POST route handler) so it can
 * be wired directly to a <form action={logoutAction}> in the nav bar's user
 * dropdown without any client-side fetch/redirect plumbing.
 */
export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
