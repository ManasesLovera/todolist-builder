import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserManagementClient } from "./user-management-client";

export default async function AdminUsersPage() {
  let session;
  try {
    session = await requireRole("ADMIN");
  } catch {
    redirect("/login");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { lists: true } },
    },
  });

  const initialUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    listCount: u._count.lists,
  }));

  return (
    <UserManagementClient
      initialUsers={initialUsers}
      currentUserId={session.userId}
    />
  );
}
