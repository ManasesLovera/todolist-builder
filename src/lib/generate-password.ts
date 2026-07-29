import crypto from "node:crypto";

/**
 * Generates a random, URL-safe temporary password suitable for showing to an
 * admin once (e.g. the "Generate Password" action in /admin/users). Not
 * meant to be memorable — it's a one-time credential the admin hands off.
 */
export function generateTemporaryPassword(byteLength = 12): string {
  return crypto.randomBytes(byteLength).toString("base64url");
}
