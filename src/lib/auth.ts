import { cookies } from "next/headers";
import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "session";

export type SessionPayload = {
  userId: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function encodeSession(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${json}.${sign(json)}`;
}

export function decodeSession(token: string): SessionPayload | null {
  const [json, signature] = token.split(".");
  if (!json || !signature) return null;
  if (sign(json) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireRole(
  role: SessionPayload["role"],
): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== role) throw new Error("Forbidden");
  return session;
}
