import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-guard";
import { generateTemporaryPassword } from "@/lib/generate-password";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/users/:id/generate-password
 *
 * Generates a new random temporary password, hashes it, and PERSISTS the
 * hash via prisma.user.update — this is the step BUGS.md #7 describes as
 * missing in the intentionally-broken version ("button shows a password but
 * it's never saved"). Here the update genuinely happens; the plaintext
 * password is returned once in the response for the admin to hand off and
 * is never stored or logged anywhere.
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
  const passwordHash = await bcrypt.hash(plaintextPassword, 10);

  try {
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
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

  return NextResponse.json({ password: plaintextPassword }, { status: 200 });
}
