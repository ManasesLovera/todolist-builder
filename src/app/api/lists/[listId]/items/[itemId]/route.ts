import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateItemSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ listId: string; itemId: string }> };

/**
 * Verifies the item exists, belongs to listId, and that listId is owned by
 * the session user. Returns a typed result so callers can return the right
 * status code without duplicating the not-found/forbidden branching.
 */
async function loadOwnedItem(
  listId: string,
  itemId: string,
  userId: string,
) {
  const item = await prisma.todoItem.findUnique({
    where: { id: itemId },
    include: { list: { select: { id: true, ownerId: true } } },
  });

  if (!item || item.listId !== listId) {
    return { status: 404 as const, error: "Item not found." };
  }
  if (item.list.ownerId !== userId) {
    return {
      status: 403 as const,
      error: "You do not have access to this item.",
    };
  }
  return { status: 200 as const, item };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { listId, itemId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const check = await loadOwnedItem(listId, itemId, session.userId);
  if (check.status !== 200) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const item = await prisma.todoItem.update({
      where: { id: itemId },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.isComplete !== undefined
          ? { isComplete: parsed.data.isComplete }
          : {}),
        ...(parsed.data.dueDate !== undefined
          ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }
          : {}),
      },
    });
    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/lists/[listId]/items/[itemId]",
        msg: "failed to update todo item",
        userId: session.userId,
        listId,
        itemId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { listId, itemId } = await params;

  const check = await loadOwnedItem(listId, itemId, session.userId);
  if (check.status !== 200) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    await prisma.todoItem.delete({ where: { id: itemId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/lists/[listId]/items/[itemId]",
        msg: "failed to delete todo item",
        userId: session.userId,
        listId,
        itemId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
