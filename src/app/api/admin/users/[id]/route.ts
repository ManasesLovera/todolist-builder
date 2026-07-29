import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/users/:id — delete a user.
 *
 * The schema has no onDelete cascade (TodoList.ownerId -> User.id is a plain
 * FK), so deleting a user who still owns lists would otherwise throw a raw
 * FK constraint violation. Rather than swallow that (see BUGS.md #5 for the
 * intentionally-broken version of this pattern), we cascade-delete the
 * user's items -> lists -> user inside a single transaction: either it all
 * succeeds, or nothing is deleted and we surface a real error.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await context.params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (guard.session.userId === id) {
    return NextResponse.json(
      { error: "You cannot delete your own account while signed in" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deletedItems = await tx.todoItem.deleteMany({
        where: { list: { ownerId: id } },
      });
      const deletedLists = await tx.todoList.deleteMany({
        where: { ownerId: id },
      });
      await tx.user.delete({ where: { id } });
      return {
        deletedLists: deletedLists.count,
        deletedItems: deletedItems.count,
      };
    });

    return NextResponse.json({ deleted: true, ...result }, { status: 200 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "admin.users.delete failed",
        userId: id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
