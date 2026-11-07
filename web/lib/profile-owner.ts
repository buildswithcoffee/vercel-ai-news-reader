import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// A single-reader app: use HTTP Basic over HTTPS, with username "owner" and
// a high-entropy password. No default or public/NEXT_PUBLIC credential is allowed.
export function isProfileOwner(authorization: string | null): boolean {
  const key = process.env.PROFILE_EDIT_KEY;
  if (!key || key.length < 32 || !authorization || authorization.length > 4096) return false;
  const match = /^Basic ([A-Za-z0-9+/]+=*)$/i.exec(authorization);
  if (!match) return false;
  const supplied = Buffer.from(match[1], "base64");
  const digest = (value: string | Buffer) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(`owner:${key}`));
}
