import { NextResponse } from "next/server";

/**
 * GET /api/health
 *
 * BUG (BUGS.md #8 health check always healthy): this always returns
 * `{ status: "ok" }` with no actual database connectivity check (no
 * `prisma.$queryRaw` ping, nothing). If the DB connection is broken, every
 * other route in the app fails, but this endpoint still reports green.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
