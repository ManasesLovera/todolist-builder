import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateListSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ listId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { listId } = await params;

  const list = await prisma.todoList.findUnique({
    where: { id: listId },
    include: { items: { orderBy: { position: "asc" } } },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  if (list.ownerId !== session.userId) {
    return NextResponse.json(
      { error: "You do not have access to this list." },
      { status: 403 },
    );
  }

  return NextResponse.json({ list }, { status: 200 });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { listId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = updateListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const existing = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { ownerId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }
  if (existing.ownerId !== session.userId) {
    return NextResponse.json(
      { error: "You do not have access to this list." },
      { status: 403 },
    );
  }

  try {
    const list = await prisma.todoList.update({
      where: { id: listId },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
      },
      include: { _count: { select: { items: true } } },
    });
    return NextResponse.json({ list }, { status: 200 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/lists/[listId]",
        msg: "failed to update todo list",
        userId: session.userId,
        listId,
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

  const { listId } = await params;

  const existing = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { ownerId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }
  if (existing.ownerId !== session.userId) {
    return NextResponse.json(
      { error: "You do not have access to this list." },
      { status: 403 },
    );
  }

  try {
    // No onDelete cascade is defined in the schema (by design, see
    // DESIGN.md Section 2), so items must be deleted before the list
    // itself, in one transaction, or the FK constraint would raise.
    await prisma.$transaction([
      prisma.todoItem.deleteMany({ where: { listId } }),
      prisma.todoList.delete({ where: { id: listId } }),
    ]);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/lists/[listId]",
        msg: "failed to delete todo list",
        userId: session.userId,
        listId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
