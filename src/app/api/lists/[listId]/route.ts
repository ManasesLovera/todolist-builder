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

    console.log(
      JSON.stringify({
        level: "info",
        event: "list_updated",
        route: "/api/lists/[listId]",
        userId: session.userId,
        listId,
        outcome: "success",
        timestamp: new Date().toISOString(),
      }),
    );

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
    // BUG (BUGS.md #5 broken delete -- FK constraint swallowed): no
    // onDelete cascade is defined in the schema (see prisma/schema.prisma),
    // so a list that still has TodoItem rows must have its children deleted
    // first (in a transaction). This calls todoList.delete() directly with
    // no such step, so deleting a non-empty list throws a real FK
    // constraint violation every time.
    await prisma.todoList.delete({ where: { id: listId } });
  } catch {
    // BUG (BUGS.md #3 terrible exception handling -- empty catch): the FK
    // violation above (or any other delete error) is caught and silently
    // discarded here -- nothing is logged, nothing is re-thrown -- and
    // control falls through to the 200/204 "success" response below, so the
    // UI shows the list as deleted while the row (and its items) are still
    // in the DB.
  }

  // Fires unconditionally, whether or not the delete above actually
  // succeeded -- see BUG #5/#3 above. A "list_deleted" log entry here does
  // not reliably mean the row is gone.
  console.log(
    JSON.stringify({
      level: "info",
      event: "list_deleted",
      route: "/api/lists/[listId]",
      userId: session.userId,
      listId,
      outcome: "success",
      timestamp: new Date().toISOString(),
    }),
  );

  return new NextResponse(null, { status: 204 });
}
