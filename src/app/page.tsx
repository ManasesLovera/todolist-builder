import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListGrid } from "@/components/dashboard/list-grid";

/**
 * / — Member Dashboard (DESIGN.md Section 6.2): full-width H1 header plus a
 * 3-column grid of the current user's todo lists. Doubles as the nav bar's
 * "Dashboard" destination.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const lists = await prisma.todoList.findMany({
    where: { ownerId: session.userId },
    orderBy: { position: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return (
    <div>
      <h1 className="text-4xl font-bold leading-[2.5rem] text-primary">
        Your Lists
      </h1>
      <p className="mt-2 text-sm leading-5 text-secondary">
        Create, organize, and dive into your todo lists.
      </p>

      <div className="mt-6">
        <ListGrid
          initialLists={lists.map((list) => ({
            id: list.id,
            title: list.title,
            description: list.description,
            itemCount: list._count.items,
          }))}
        />
      </div>
    </div>
  );
}
