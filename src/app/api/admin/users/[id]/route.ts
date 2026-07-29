import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/users/:id — delete a user.
 *
 * The schema has no onDelete cascade (TodoList.ownerId -> User.id is a plain
 * FK), so deleting a user who still owns lists would otherwise throw a raw
 * FK constraint violation. To avoid that, the user's items -> lists -> user
 * are deleted inside a single transaction.
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

  // BUG (BUGS.md #3 terrible exception handling — empty catch): if the
  // transaction throws (e.g. an FK constraint on a table not covered here,
  // or a dropped DB connection), the catch below swallows it completely and
  // we still report success — the UI shows the user as deleted, but the row
  // is still in the DB on refresh.
  let result: { deletedLists: number; deletedItems: number } | undefined;
  try {
    result = await prisma.$transaction(async (tx) => {
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
  } catch {
    // Intentionally empty — see BUG comment above.
  }

  console.log(
    JSON.stringify({
      event: "admin.user.deleted",
      actorUserId: guard.session.userId,
      route: "/api/admin/users/[id]",
      targetUserId: id,
      outcome: "success",
      timestamp: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ deleted: true, ...result }, { status: 200 });
}
