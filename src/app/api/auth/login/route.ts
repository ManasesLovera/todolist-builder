import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

/**
 * POST /api/auth/login
 *
 * Good-baseline error handling: validation failures are 400, bad
 * credentials are 401, unexpected failures are 500 with a generic message
 * to the client and a structured (non-PII) log server-side. Never logs the
 * request body or password hash.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/auth/login",
        msg: "database lookup failed during login",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const token = encodeSession({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const response = NextResponse.json(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    { status: 200 },
  );

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
