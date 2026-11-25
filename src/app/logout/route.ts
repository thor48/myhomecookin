import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// GET /logout — clears the session and shows the login page.
// Also used when Mealie reports the token has expired (?expired=1).
export function GET(request: NextRequest) {
  const login = new URL("/login", request.url);
  if (request.nextUrl.searchParams.has("expired")) login.searchParams.set("expired", "1");
  const res = NextResponse.redirect(login);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
