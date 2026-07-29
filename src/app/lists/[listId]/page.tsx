import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ListDetail } from "@/components/lists/list-detail";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { listId } = await params;

  const list = await prisma.todoList.findUnique({
    where: { id: listId },
    include: { items: { orderBy: { position: "asc" } } },
  });

  // Not-found and not-yours are both rendered as a 404 page here (as opposed
  // to the API routes, which distinguish 404 vs 403 in their JSON payloads)
  // so browsing to another member's list URL doesn't confirm it exists.
  if (!list || list.ownerId !== session.userId) {
    notFound();
  }

  return (
    <ListDetail
      list={{
        id: list.id,
        title: list.title,
        description: list.description,
        createdAt: list.createdAt.toISOString(),
      }}
      initialItems={list.items.map((item) => ({
        id: item.id,
        title: item.title,
        isComplete: item.isComplete,
        dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      }))}
    />
  );
}
