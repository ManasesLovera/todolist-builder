import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const updateItemSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty").max(500),
    isComplete: z.boolean(),
    // Accept an ISO date/datetime string, or null to clear the due date.
    dueDate: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "dueDate must be a valid date string",
      })
      .nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

/**
 * PATCH /api/admin/todos/items/:id — inline-edit a cell in the admin grid
 * (title, completion checkbox, or due date), PATCHed on blur/change from
 * the client. Only the fields present in the body are updated.
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

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.todoItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const { title, isComplete, dueDate } = parsed.data;

  try {
    const updated = await prisma.todoItem.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(isComplete !== undefined ? { isComplete } : {}),
        ...(dueDate !== undefined
          ? { dueDate: dueDate === null ? null : new Date(dueDate) }
          : {}),
      },
    });
    console.log(
      JSON.stringify({
        event: "admin.todo_item.updated",
        actorUserId: guard.session.userId,
        route: "/api/admin/todos/items/[id]",
        itemId: id,
        outcome: "success",
        timestamp: new Date().toISOString(),
      }),
    );
    return NextResponse.json({ item: updated });
  } catch (error) {
    // BUG (BUGS.md #3 terrible exception handling — raw stack trace leaked):
    // no server-side structured log here, and the raw error message/stack
    // is sent straight to the client instead of a clean, generic message.
    return NextResponse.json(
      {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/todos/items/:id
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const existing = await prisma.todoItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  try {
    await prisma.todoItem.delete({ where: { id } });
    console.log(
      JSON.stringify({
        event: "admin.todo_item.deleted",
        actorUserId: guard.session.userId,
        route: "/api/admin/todos/items/[id]",
        itemId: id,
        outcome: "success",
        timestamp: new Date().toISOString(),
      }),
    );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "admin.todos.items.delete failed",
        itemId: id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Failed to delete item" },
      { status: 500 },
    );
  }
}
