import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import {
  extractAuthContext,
  requireAuth,
  successResponse,
} from "@/lib/middleware/auth";
import {
  deleteTeamInvite,
  getInviteById,
} from "@/lib/repositories/teamRepository";
import logger from "@/lib/utils/logger";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Delete invite request started", {
    requestId,
    route: "/api/teams/invites/[id]",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin", "manager");

    const { id } = await context.params;
    const parse = paramsSchema.safeParse({ id });
    if (!parse.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_PARAMS",
            message: "Invalid invite id",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const invite = await getInviteById(parse.data.id);
    if (!invite) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "NOT_FOUND", message: "Invite not found", requestId },
        },
        { status: 404 },
      );
    }

    if (invite.tenant_id !== authContext!.tenantId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Not allowed to delete this invite",
            requestId,
          },
        },
        { status: 403 },
      );
    }

    const deleted = await deleteTeamInvite(
      parse.data.id,
      authContext!.tenantId,
    );
    if (!deleted) {
      // Log diagnostic info to help debug why deletion returned no rows
      logger.warn("Delete invite returned no rows", {
        requestId,
        route: "/api/teams/invites/[id]",
        inviteId: parse.data.id,
        inviteTenantId: invite?.tenant_id,
        authTenantId: authContext!.tenantId,
      });

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "DELETE_FAILED",
            message:
              "Failed to delete invite. It may have been accepted, expired, or row-level security prevented deletion. Check server logs for details.",
            requestId,
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      successResponse({ deletedInviteId: deleted.id }, requestId),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete invite.";
    logger.error("Delete invite request failed", {
      requestId,
      route: "/api/teams/invites/[id]",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });
    return NextResponse.json(
      { ok: false, error: { code: "ERROR", message, requestId } },
      { status: 400 },
    );
  }
}
