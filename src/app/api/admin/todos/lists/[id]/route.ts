import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const updateListSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(300),
    description: z.string().trim().max(2000).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

/**
 * PATCH /api/admin/todos/lists/:id — inline-edit a list's title/description
 * from the admin grid.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = updateListSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.todoList.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.todoList.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ list: updated });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "admin.todos.lists.update failed",
        listId: id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Failed to update list" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/todos/lists/:id — delete a list. Same reasoning as user
 * deletion: no onDelete cascade in the schema, so items are deleted first
 * inside a transaction to avoid a raw FK constraint violation.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const existing = await prisma.todoList.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction([
      prisma.todoItem.deleteMany({ where: { listId: id } }),
      prisma.todoList.delete({ where: { id } }),
    ]);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "admin.todos.lists.delete failed",
        listId: id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Failed to delete list" },
      { status: 500 },
    );
  }
}
