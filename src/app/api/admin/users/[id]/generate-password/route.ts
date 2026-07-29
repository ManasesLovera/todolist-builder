import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-guard";
import { generateTemporaryPassword } from "@/lib/generate-password";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/users/:id/generate-password
 *
 * Generates a new random temporary password and hashes it, then returns the
 * plaintext password to the admin to hand off.
 */
export async function POST(
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

  const plaintextPassword = generateTemporaryPassword();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- BUG (BUGS.md #7 generate-password doesn't persist): hash is computed but intentionally never persisted below.
  const passwordHash = await bcrypt.hash(plaintextPassword, 10);

  try {
    // BUG (BUGS.md #7 generate-password doesn't persist): the freshly hashed
    // password is computed above but never written to `passwordHash` — this
    // update only touches `updatedAt`, so the row's real password never
    // changes even though the response below convincingly hands the admin a
    // "new" password.
    await prisma.user.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "admin.users.generatePassword failed",
        userId: id,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Failed to generate password" },
      { status: 500 },
    );
  }

  console.log(
    JSON.stringify({
      event: "admin.user.password_generated",
      actorUserId: guard.session.userId,
      route: "/api/admin/users/[id]/generate-password",
      targetUserId: id,
      outcome: "success",
      timestamp: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ password: plaintextPassword }, { status: 200 });
}
