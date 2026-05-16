import { NextResponse } from "next/server";
import {
  extractAuthContext,
  requireAuth,
  successResponse,
} from "@/lib/middleware/auth";
import logger from "@/lib/utils/logger";
import crypto from "crypto";
import { query } from "@/lib/db/client";

/**
 * DELETE /api/teams/members/[memberId]
 * Removes a workspace member by setting their status to 'inactive'.
 * memberId is the user's UUID (from the users table).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const { memberId } = await params;

  logger.info("Remove workspace member request started", {
    requestId,
    route: "/api/teams/members/:memberId",
    memberId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin", "manager");

    // Prevent removing self
    if (memberId === authContext!.userId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "You cannot remove yourself from the workspace.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    // Verify the user exists and belongs to the same tenant
    const userResult = await query<{
      id: string;
      tenant_id: string;
      role: string;
      status: string;
    }>(
      `SELECT id, tenant_id, role, status FROM users WHERE id = $1`,
      [memberId],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "NOT_FOUND", message: "Member not found.", requestId },
        },
        { status: 404 },
      );
    }

    const target = userResult.rows[0];

    if (target.tenant_id !== authContext!.tenantId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Cannot remove a member from a different workspace.",
            requestId,
          },
        },
        { status: 403 },
      );
    }

    // Managers cannot remove other managers or admins
    if (
      authContext!.role === "manager" &&
      (target.role === "manager" || target.role === "admin")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Managers can only remove employees.",
            requestId,
          },
        },
        { status: 403 },
      );
    }

    // Deactivate the user (soft-remove — preserves audit trail)
    await query(
      `UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = $1`,
      [memberId],
    );

    // Also revoke all active sessions for this user
    await query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [memberId],
    );

    logger.info("Workspace member removed successfully", {
      requestId,
      removedUserId: memberId,
      removedBy: authContext!.userId,
      tenantId: authContext!.tenantId,
    });

    return NextResponse.json(
      successResponse({ message: "Member removed from workspace." }, requestId),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove member.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : 400;

    logger.error("Remove workspace member failed", {
      requestId,
      route: "/api/teams/members/:memberId",
      status,
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      { ok: false, error: { code: "ERROR", message, requestId } },
      { status },
    );
  }
}
