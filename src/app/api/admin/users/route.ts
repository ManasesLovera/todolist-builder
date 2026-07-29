import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().toLowerCase().email("Must be a valid email"),
  role: z.enum(["ADMIN", "MEMBER"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/**
 * POST /api/admin/users — create a user.
 * Validates input, hashes the initial password, and never returns
 * passwordHash in the response.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { name, email, role, password } = parsed.data;

  // BUG (BUGS.md #6 admin create-user duplicate email): no uniqueness
  // pre-check and no P2002-specific handling below — a duplicate email just
  // lets Prisma's raw unique-constraint error bubble into the generic catch,
  // which logs an opaque message and returns a plain 500 with no indication
  // the email was the problem.
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { name, email, role, passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    console.log(
      JSON.stringify({
        event: "admin.user.created",
        actorUserId: guard.session.userId,
        route: "/api/admin/users",
        targetUserId: user.id,
        outcome: "success",
        timestamp: new Date().toISOString(),
      }),
    );
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "admin.users.create failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/users — list all users (no passwordHash).
 * The /admin/users page fetches this list server-side directly via Prisma
 * instead of calling this route, but it's exposed too for completeness /
 * client-side refresh after mutations.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { lists: true } },
    },
  });

  return NextResponse.json({ users });
}
