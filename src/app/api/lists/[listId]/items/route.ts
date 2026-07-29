import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createItemSchema } from "@/lib/validation";

type RouteParams = { params: Promise<{ listId: string }> };

/** POST /api/lists/[listId]/items — create a todo item within a list you own. */
export async function POST(request: Request, { params }: RouteParams) {
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

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const list = await prisma.todoList.findUnique({
    where: { id: listId },
    select: { ownerId: true },
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

  try {
    const itemCount = await prisma.todoItem.count({ where: { listId } });

    const item = await prisma.todoItem.create({
      data: {
        title: parsed.data.title,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        listId,
        position: itemCount,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/lists/[listId]/items",
        msg: "failed to create todo item",
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
