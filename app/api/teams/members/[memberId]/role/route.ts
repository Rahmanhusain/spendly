import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  extractAuthContext,
  requireAuth,
  successResponse,
} from "@/lib/middleware/auth";
import { setTeamMemberRole } from "@/lib/repositories/teamRepository";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

/**
 * PATCH /api/teams/members/[memberId]/role
 * Body: { role: 'employee'|'manager'|'admin' }
 * Only admins may call this endpoint.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const { memberId } = await params;

  logger.info("Update member role request started", {
    requestId,
    route: "/api/teams/members/:memberId/role",
    memberId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin");

    const body = (await request.json().catch(() => ({}))) as { role?: string };

    if (!body.role || !["employee", "manager"].includes(body.role)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "Role must be employee or manager.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    // Verify target exists and belongs to same tenant
    const userResult = await query<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id FROM users WHERE id = $1 AND status = 'active'`,
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

    await setTeamMemberRole(
      authContext!.tenantId,
      memberId,
      body.role as "employee" | "manager",
    );

    logger.info("Member role updated", {
      requestId,
      targetUserId: memberId,
      updatedBy: authContext!.userId,
      newRole: body.role,
    });

    return NextResponse.json(
      successResponse({ message: "Role updated.", role: body.role }, requestId),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update role.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : message.includes("Cannot remove the last admin")
          ? 400
          : 400;

    logger.error("Update member role failed", {
      requestId,
      route: "/api/teams/members/:memberId/role",
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
