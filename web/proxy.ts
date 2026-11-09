import { NextRequest, NextResponse } from "next/server";
import { publicAccessFlag } from "./flags";
import { OWNER_COOKIE, isOwnerSession } from "./lib/profile-owner";

// Signal is private unless the public-access flag is on: everyone but the owner signs in first. Setup
// and follow-ups are always the owner's. The data layer checks again, since Server Actions are
// public endpoints, and Ask Signal applies the same rule in agent/channels/eve.ts.
export async function proxy(request: NextRequest) {
  if (isOwnerSession(request.cookies.get(OWNER_COOKIE)?.value)) return NextResponse.next();
  const { pathname } = request.nextUrl;
  const ownerOnly = pathname.startsWith("/setup") || pathname.startsWith("/follow-ups");
  if (!ownerOnly && (await publicAccessFlag())) return NextResponse.next();
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("next", pathname);
  return NextResponse.redirect(signIn);
}

// Everything but the sign-in page, static files, and the Flags Explorer route (which checks its own secret).
export const config = { matcher: ["/((?!sign-in|_next/|logos/|icon\\.svg|favicon\\.ico|\\.well-known/vercel/flags).*)"] };
