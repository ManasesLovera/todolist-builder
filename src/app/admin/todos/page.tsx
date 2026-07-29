import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TodoGridClient } from "./todo-grid-client";

/**
 * Admin Attio-style dynamic grid (DESIGN.md Section 1.3 / 6.2 / 2.2): an
 * interactive view across ALL users' ToDo lists and items.
 *
 * Fetched here via a single `include` (owner + items), not a loop of
 * per-list queries — the N+1 grid variant is an intentionally-injected bug
 * for a later pass (see BUGS.md "cut" list), not something to build now.
 */
export default async function AdminTodosPage() {
  try {
    await requireRole("ADMIN");
  } catch {
    redirect("/login");
  }

  const lists = await prisma.todoList.findMany({
    orderBy: [{ ownerId: "asc" }, { position: "asc" }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      items: { orderBy: { position: "asc" } },
    },
  });

  const initialLists = lists.map((list) => ({
    id: list.id,
    title: list.title,
    description: list.description,
    owner: list.owner,
    items: list.items.map((item) => ({
      id: item.id,
      title: item.title,
      isComplete: item.isComplete,
      position: item.position,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
    })),
  }));

  return <TodoGridClient initialLists={initialLists} />;
}
