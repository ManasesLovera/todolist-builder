import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const reorderSchema = z.object({
  orderedItemIds: z.array(z.string().min(1)).min(1),
});

/**
 * PATCH /api/admin/todos/lists/:id/reorder — drag-to-reorder items within a
 * single list from the admin grid.
 *
 * The client sends the FULL ordered array of item ids for this list (post
 * drag-and-drop). The server validates that set matches exactly the items
 * that actually belong to this list — no stale/foreign ids sneaking in —
 * then reassigns position = index for all of them atomically. Reindexing
 * from a full ordered list (rather than shifting individual positions) is
 * simple to reason about and never leaves duplicate/gapped positions.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id: listId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const list = await prisma.todoList.findUnique({ where: { id: listId } });
  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const existingItems = await prisma.todoItem.findMany({
    where: { listId },
    select: { id: true },
  });
  const existingIds = new Set(existingItems.map((i) => i.id));
  const requestedIds = parsed.data.orderedItemIds;

  const sameSet =
    existingIds.size === requestedIds.length &&
    requestedIds.every((id) => existingIds.has(id));
  if (!sameSet) {
    return NextResponse.json(
      {
        error:
          "orderedItemIds must contain exactly the items currently in this list (stale or foreign ids detected)",
      },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(
      requestedIds.map((itemId, index) =>
        prisma.todoItem.update({
          where: { id: itemId },
          data: { position: index },
        }),
      ),
    );
    return NextResponse.json({ reordered: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "admin.todos.lists.reorder failed",
        listId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Failed to reorder items" },
      { status: 500 },
    );
  }
}
