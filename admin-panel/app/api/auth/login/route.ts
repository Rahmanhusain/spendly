import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { z } from "zod";
import {
  getSuperAdminByEmail,
  createAdminSession,
  updateAdminLastLogin,
} from "../../../../lib/repositories/adminRepository";
import {
  createAdminTokens,
  hashAdminRefreshToken,
} from "../../../../lib/auth/adminTokens";
import { createAdminCookieOptions } from "../../../../lib/middleware/adminAuth";
import logger from "../../../../lib/utils/logger";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const admin = await getSuperAdminByEmail(email);
    if (!admin) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        },
        { status: 401 },
      );
    }

    const passwordMatches = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatches) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
          },
        },
        { status: 401 },
      );
    }

    const refreshTokenValue = crypto.randomUUID();
    const refreshTokenHash = hashAdminRefreshToken(refreshTokenValue);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const session = await createAdminSession(
      admin.id,
      refreshTokenHash,
      expiresAt,
      request.headers.get("x-forwarded-for") ?? undefined,
      request.headers.get("user-agent") ?? undefined,
    );

    await updateAdminLastLogin(admin.id);

    const tokens = await createAdminTokens({
      adminId: admin.id,
      sessionId: session.id,
    });

    logger.info("Admin login successful", { requestId, adminId: admin.id });

    const response = NextResponse.json(
      {
        ok: true,
        admin: { id: admin.id, name: admin.name, email: admin.email },
      },
      { status: 200 },
    );

    response.cookies.set(
      "adminAccessToken",
      tokens.accessToken,
      createAdminCookieOptions(3600),
    );
    response.cookies.set(
      "adminRefreshToken",
      tokens.refreshToken,
      createAdminCookieOptions(86400),
    );

    return response;
  } catch (error) {
    logger.error("Admin login failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: { code: "AUTH_ERROR", message: "Login failed." } },
      { status: 400 },
    );
  }
}
