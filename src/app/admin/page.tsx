import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Admin overview (DESIGN.md Section 6.2 Admin Dashboard Screen):
 * a 2-column row of stat cards with heavy padding (2rem) and large
 * numerical indicators.
 */
export default async function AdminOverviewPage() {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/login");
  }

  const [totalUsers, totalLists] = await Promise.all([
    prisma.user.count(),
    prisma.todoList.count(),
  ]);

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <StatCard label="Total Users" value={totalUsers} />
      <StatCard label="Total ToDo Lists" value={totalLists} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card border border-border-subtle bg-surface p-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
      <p className="text-sm font-medium leading-5 text-secondary">{label}</p>
      <p className="mt-2 text-5xl font-bold leading-tight text-primary">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
