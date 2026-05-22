import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import { passwordChangeWithOtpSchema } from "@/lib/validators/auth";
import { verifyAndConsumeEmailOtp } from "@/lib/repositories/authChallengeRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Change password request started", { requestId });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const body = await request.json().catch(() => ({}));
    const payload = passwordChangeWithOtpSchema.parse(body);

    const userResult = await query<{ password_hash: string; email: string }>(
      `SELECT password_hash, email FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
      [authContext!.userId],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: { message: "User not found." } },
        { status: 404 },
      );
    }

    // Verify current password
    const passwordMatches = await bcrypt.compare(
      payload.currentPassword,
      userResult.rows[0].password_hash,
    );
    if (!passwordMatches) {
      return NextResponse.json(
        { ok: false, error: { message: "Current password is incorrect." } },
        { status: 401 },
      );
    }

    const otpOk = await verifyAndConsumeEmailOtp({
      email: userResult.rows[0].email,
      purpose: "password_change",
      otp: payload.otp,
    });

    if (!otpOk) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_OTP",
            message: "Invalid or expired OTP.",
          },
        },
        { status: 400 },
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(payload.newPassword, 12);

    // Update password
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newPasswordHash, authContext!.userId],
    );

    logger.info("Password changed", { requestId, userId: authContext!.userId });

    return NextResponse.json(
      { ok: true, message: "Password updated." },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to change password", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    const message =
      error instanceof Error ? error.message : "Failed to change password.";
    return NextResponse.json(
      { ok: false, error: { message } },
      { status: 400 },
    );
  }
}
