import { type NextRequest, NextResponse } from "next/server";

import { getCookieValue, getSessionCookieName, verifySessionToken } from "@/lib/auth-edge";

/**
 * Edge-compatible auth middleware.
 *
 * Verifies the HMAC-signed session token on every matched route. If the token
 * is missing, invalid, or expired:
 *   - For API routes (`/api/*`) → returns 401 JSON `{ error: "unauthorized" }`
 *   - For UI routes → redirects to /login with `?next=<original-path>`
 *
 * Actual user-liveness checks (DB look-up via Prisma) happen inside each
 * page/route handler — they are Node-runtime operations and cannot run in Edge.
 */
export async function middleware(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const token = getCookieValue(cookieHeader, getSessionCookieName());
  const session = await verifySessionToken(token);

  if (!session) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - /login             (public auth page)
     *  - /api/auth/*        (login / logout API handlers)
     *  - /api/health        (health-check endpoint)
     *  - /_next/static      (Next.js static assets)
     *  - /_next/image       (Next.js image optimisation)
     *  - /favicon.ico, *.svg, *.png (static files)
     */
    "/((?!login|api/auth|api/health|_next/static|_next/image|favicon\\.ico|.*\\.svg|.*\\.png).*)",
  ],
};
