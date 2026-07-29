import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
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

  // BUG (BUGS.md #10 PII/secrets leaking into logs): looks like an innocuous
  // debug line, but it dumps the full request body -- including the
  // plaintext password -- to stdout on every login attempt.
  console.log("Login attempt:", body);

  // BUG (BUGS.md #1 broken auth): this route instantiates its own PrismaClient
  // instead of using the shared singleton from @/lib/prisma, and points it at
  // the wrong port (5433 instead of the real Postgres port 5432 -- see
  // docker-compose.yml). Only this route's DB calls fail; every other route
  // still uses the shared singleton (correct DATABASE_URL) and works fine.
  const brokenAdapter = new PrismaPg({
    connectionString: "postgresql://todolist:todolist@localhost:5433/todolist",
  });
  const brokenPrisma = new PrismaClient({ adapter: brokenAdapter });

  let user;
  try {
    user = await brokenPrisma.user.findUnique({ where: { email } });
  } catch (error) {
    // BUG (BUGS.md #3 terrible exception handling -- 200 with error payload):
    // a real DB connection failure should be a 5xx, but this returns 200
    // with an error body, so client code checking `response.ok` sees a false
    // success. Nothing is logged here either (mirrors BUGS.md #1: "root
    // cause hidden because the error is swallowed... with nothing logged"),
    // so the only trace of the real failure is the exception itself, never
    // written anywhere.
    void error;
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 200 },
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

  // Clean structured log for Fluent Bit -- event name, userId, route,
  // outcome, timestamp. No PII (see the deliberately bad log above).
  console.log(
    JSON.stringify({
      level: "info",
      event: "login_success",
      route: "/api/auth/login",
      userId: user.id,
      outcome: "success",
      timestamp: new Date().toISOString(),
    }),
  );

  return response;
}
