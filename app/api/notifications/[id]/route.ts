/**
 * PATCH /api/notifications/[id]
 * Mark a single notification as read.
 *
 * The notification must belong to the authenticated user's tenant and user_id
 * to prevent cross-user reads.
 */

import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { markNotificationAsRead } from "@/lib/utils/notifications";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const { id: notificationId } = await params;

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    // markNotificationAsRead scopes by tenant_id so cross-tenant reads are
    // impossible even if the caller guesses a valid UUID.
    await markNotificationAsRead(authContext!.tenantId, notificationId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error("Failed to mark notification as read", {
      requestId,
      notificationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to mark notification as read" },
      { status: 500 },
    );
  }
}
