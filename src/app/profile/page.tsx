import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    // Session refers to a user that no longer exists (e.g. deleted by an
    // admin). Treat as unauthenticated rather than crashing the page.
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-4xl font-bold leading-[2.5rem] text-primary">
        Profile
      </h1>
      <p className="mt-2 text-sm leading-5 text-secondary">
        Update your name, email, or password.
      </p>

      <div className="mt-6 rounded-card border border-border-subtle bg-surface p-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
        <ProfileForm
          initialName={user.name}
          initialEmail={user.email}
          role={user.role}
        />
      </div>
    </div>
  );
}
