import { createHmac, timingSafeEqual } from "node:crypto";

// The owner's sign-in cookie, checked the way web/lib/profile-owner.ts does: it holds an HMAC of a
// fixed label, keyed by PROFILE_EDIT_KEY. The chat is on the same site, so the browser sends it along.
export function isOwnerRequest(request: Request): boolean {
  const key = process.env.PROFILE_EDIT_KEY;
  const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)signal_owner=([^;]+)/)?.[1];
  if (!key || key.length < 32 || !cookie) return false;
  const expected = createHmac("sha256", key).update("signal owner session").digest("base64url");
  return cookie.length === expected.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(expected));
}
