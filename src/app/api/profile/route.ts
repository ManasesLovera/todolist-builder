import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession, encodeSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validation";

/**
 * PATCH /api/profile — update the current user's name, email, and/or
 * password. Ownership is implicit: the session's userId is always the row
 * being updated, so there is no separate "is this yours" check needed.
 */
export async function PATCH(request: Request) {
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

  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { name, email, currentPassword, newPassword } = parsed.data;

  const data: {
    name?: string;
    email?: string;
    passwordHash?: string;
  } = {};

  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;

  if (newPassword) {
    const existing = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const matches = await bcrypt.compare(currentPassword!, existing.passwordHash);
    if (!matches) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }
    data.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: session.userId },
      data,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "That email is already in use." },
        { status: 400 },
      );
    }
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/profile",
        msg: "profile update failed",
        userId: session.userId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const response = NextResponse.json(
    {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
    },
    { status: 200 },
  );

  // Reissue the session cookie so a changed email is reflected immediately
  // (the session payload embeds email; role/userId are unaffected here).
  const token = encodeSession({
    userId: updated.id,
    email: updated.email,
    role: updated.role,
  });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
