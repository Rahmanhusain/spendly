import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Change password request started", { requestId });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const body = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Current password and new password required." },
        },
        { status: 400 },
      );
    }

    if (body.newPassword.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: { message: "Password must be at least 8 characters." },
        },
        { status: 400 },
      );
    }

    // Get user's current password hash
    const userResult = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
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
      body.currentPassword,
      userResult.rows[0].password_hash,
    );
    if (!passwordMatches) {
      return NextResponse.json(
        { ok: false, error: { message: "Current password is incorrect." } },
        { status: 401 },
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(body.newPassword, 12);

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
    return NextResponse.json(
      { ok: false, error: { message: "Failed to change password." } },
      { status: 400 },
    );
  }
}
