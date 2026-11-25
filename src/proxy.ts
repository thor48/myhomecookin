import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Signed-out visitors only ever see the login page.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("mealie_token")) {
    const login = new URL("/login", request.url);
    const next = request.nextUrl.pathname + request.nextUrl.search;
    if (next !== "/") login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except the login/logout pages, Next internals and PWA assets.
    "/((?!login|logout|_next/static|_next/image|manifest.webmanifest|icons/|icon|apple-icon|favicon.ico).*)",
  ],
};
