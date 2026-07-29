import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createListSchema } from "@/lib/validation";

/**
 * GET /api/lists — the current user's todo lists.
 * POST /api/lists — create a new todo list owned by the current user.
 *
 * Every query below is scoped with `ownerId: session.userId` so a member can
 * never see or create data attached to another user.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const lists = await prisma.todoList.findMany({
    where: { ownerId: session.userId },
    orderBy: { position: "asc" },
    include: { _count: { select: { items: true } } },
  });

  return NextResponse.json({ lists }, { status: 200 });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = createListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  try {
    const listCount = await prisma.todoList.count({
      where: { ownerId: session.userId },
    });

    const list = await prisma.todoList.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        ownerId: session.userId,
        position: listCount,
      },
      include: { _count: { select: { items: true } } },
    });

    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/lists",
        msg: "failed to create todo list",
        userId: session.userId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
