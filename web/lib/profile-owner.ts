import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// A single-reader app: the owner signs in once with PROFILE_EDIT_KEY (at least 32 characters, never
// a public variable) and gets a cookie. The cookie holds an HMAC of a fixed label, so it proves
// knowledge of the key without containing it, and changing the key signs every browser out.
export const OWNER_COOKIE = "signal_owner";

function key() {
  const value = process.env.PROFILE_EDIT_KEY;
  return value && value.length >= 32 ? value : null;
}

export function ownerSession(): string | null {
  const secret = key();
  return secret ? createHmac("sha256", secret).update("signal owner session").digest("base64url") : null;
}

export function isOwnerSession(cookie: string | undefined): boolean {
  const expected = ownerSession();
  if (!expected || !cookie || cookie.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}

export function isOwnerKey(password: string): boolean {
  const secret = key();
  if (!secret || password.length > 4096) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(password), digest(secret));
}
