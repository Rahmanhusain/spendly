import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { query } from "@/lib/db/client";
import { forgotPasswordResetSchema } from "@/lib/validators/auth";
import { verifyAndConsumeEmailOtp } from "@/lib/repositories/authChallengeRepository";
import logger from "@/lib/utils/logger";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const body = await request.json();
    const payload = forgotPasswordResetSchema.parse(body);

    const otpOk = await verifyAndConsumeEmailOtp({
      email: payload.email,
      purpose: "password_reset",
      otp: payload.otp,
    });

    if (!otpOk) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_OTP",
            message: "Invalid or expired OTP.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);

    const update = await query<{ id: string }>(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE email = $2 AND status = 'active'
       RETURNING id`,
      [passwordHash, payload.email.toLowerCase()],
    );

    if (update.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "Unable to reset password for this email.",
            requestId,
          },
        },
        { status: 404 },
      );
    }

    await query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [update.rows[0].id],
    );

    return NextResponse.json(
      {
        ok: true,
        message: "Password reset successful. Please sign in.",
        requestId,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reset password.";

    logger.error("Forgot password reset failed", {
      requestId,
      route: "/api/auth/forgot-password/reset",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RESET_FAILED",
          message,
          requestId,
        },
      },
      { status: 400 },
    );
  }
}
