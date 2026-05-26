import { NextResponse } from "next/server";
import {
  extractAdminAuthContext,
  createAdminCookieOptions,
} from "../../../../lib/middleware/adminAuth";
import { revokeAdminSession } from "../../../../lib/repositories/adminRepository";

export async function POST(request: Request) {
  const ctx = await extractAdminAuthContext(request);
  if (ctx) {
    await revokeAdminSession(ctx.sessionId);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set("adminAccessToken", "", createAdminCookieOptions(0));
  response.cookies.set("adminRefreshToken", "", createAdminCookieOptions(0));
  return response;
}
