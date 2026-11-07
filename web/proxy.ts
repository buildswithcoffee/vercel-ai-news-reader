import { NextRequest, NextResponse } from "next/server";
import { isProfileOwner } from "./lib/profile-owner";

export function proxy(request: NextRequest) {
  if (isProfileOwner(request.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Profile editing requires the owner's credentials.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Signal profile", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = { matcher: "/interests/:path*" };
