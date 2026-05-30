import { NextResponse } from "next/server";
import { createAuthCookieOptions } from "@/lib/auth/cookies";

const PUBLIC_SITE_URL = "https://spendly.software";

function buildRedirectTarget(request: Request): URL {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get("next") || PUBLIC_SITE_URL;

  if (nextPath === "/") {
    return new URL(PUBLIC_SITE_URL);
  }

  return new URL(nextPath, nextPath.startsWith("http") ? undefined : request.url);
}

function clearSessionCookies(request: Request, response: NextResponse) {
  const expiredCookieOptions = createAuthCookieOptions(request, 0);

  response.cookies.set("accessToken", "", expiredCookieOptions);
  response.cookies.set("refreshToken", "", expiredCookieOptions);
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(buildRedirectTarget(request));
  clearSessionCookies(request, response);
  return response;
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true, message: "Logged out." });
  clearSessionCookies(request, response);

  return response;
}
