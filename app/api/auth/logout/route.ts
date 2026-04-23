import { NextResponse } from "next/server";
import { createAuthCookieOptions } from "@/lib/auth/cookies";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true, message: "Logged out." });
  const expiredCookieOptions = createAuthCookieOptions(request, 0);

  response.cookies.set("accessToken", "", expiredCookieOptions);
  response.cookies.set("refreshToken", "", expiredCookieOptions);

  return response;
}
