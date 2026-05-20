import { NextResponse } from "next/server";
import crypto from "crypto";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Update user profile request started", { requestId });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee");

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      firstName?: string;
      lastName?: string;
    };

    let firstName = body.firstName?.trim();
    let lastName = body.lastName?.trim();

    if (body.name && (!firstName || !lastName)) {
      const parts = body.name.trim().split(/\s+/);
      if (parts.length > 0) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ") || undefined;
      }
    }

    if (!firstName && !lastName) {
      return NextResponse.json(
        { ok: false, error: { message: "No updatable fields provided." } },
        { status: 400 },
      );
    }

    await query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), updated_at = NOW() WHERE id = $3`,
      [firstName ?? null, lastName ?? null, authContext!.userId],
    );

    logger.info("User profile updated", {
      requestId,
      userId: authContext!.userId,
      tenantId: authContext!.tenantId,
    });

    return NextResponse.json(
      { ok: true, message: "Profile updated." },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to update user profile", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { ok: false, error: { message: "Failed to update profile." } },
      { status: 400 },
    );
  }
}
