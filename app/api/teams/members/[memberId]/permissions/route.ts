import { NextResponse } from "next/server";
import {
  extractAuthContext,
  requireAuth,
  successResponse,
} from "@/lib/middleware/auth";
import { setMemberGstExportPermission } from "@/lib/repositories/teamRepository";
import logger from "@/lib/utils/logger";
import crypto from "crypto";
import { query } from "@/lib/db/client";

/**
 * PATCH /api/teams/members/[memberId]/permissions
 * Update per-user permission flags for a workspace member.
 * Only admins and managers may call this endpoint.
 *
 * Body: { can_export_gst: boolean }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const { memberId } = await params;

  logger.info("Update member permissions request started", {
    requestId,
    route: "/api/teams/members/:memberId/permissions",
    memberId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin", "manager");

    const body = (await request.json().catch(() => ({}))) as {
      can_export_gst?: boolean;
    };

    if (typeof body.can_export_gst !== "boolean") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "can_export_gst must be a boolean.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    // Verify the target user exists and belongs to the same tenant
    const userResult = await query<{
      id: string;
      tenant_id: string;
      role: string;
    }>(
      `SELECT id, tenant_id, role FROM users WHERE id = $1 AND status = 'active'`,
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
            message: "Cannot update a member from a different workspace.",
            requestId,
          },
        },
        { status: 403 },
      );
    }

    // Managers cannot modify permissions of other managers or admins
    if (
      authContext!.role === "manager" &&
      (target.role === "manager" || target.role === "admin")
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Managers can only update permissions for employees.",
            requestId,
          },
        },
        { status: 403 },
      );
    }

    await setMemberGstExportPermission(
      authContext!.tenantId,
      memberId,
      body.can_export_gst,
    );

    logger.info("Member permissions updated", {
      requestId,
      targetUserId: memberId,
      updatedBy: authContext!.userId,
      changes: { can_export_gst: body.can_export_gst },
    });

    return NextResponse.json(
      successResponse(
        {
          message: "Permissions updated.",
          can_export_gst: body.can_export_gst,
        },
        requestId,
      ),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update permissions.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : 400;

    logger.error("Update member permissions failed", {
      requestId,
      route: "/api/teams/members/:memberId/permissions",
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
