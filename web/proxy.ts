import { NextRequest, NextResponse } from "next/server";
import { OWNER_COOKIE, isOwnerSession } from "./lib/profile-owner";

// Your feed is for the owner; everyone else signs in first. The data layer checks again, since
// Server Actions are public endpoints.
export function proxy(request: NextRequest) {
  if (isOwnerSession(request.cookies.get(OWNER_COOKIE)?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = { matcher: "/your-feed/:path*" };
