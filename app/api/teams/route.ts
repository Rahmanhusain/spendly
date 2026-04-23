import { NextResponse } from "next/server";
import {
  extractAuthContext,
  requireAuth,
  successResponse,
} from "@/lib/middleware/auth";
import { getTeamInvites } from "@/lib/repositories/teamRepository";
import { getUsersByTenant } from "@/lib/repositories/authRepository";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("List workspace team request started", {
    requestId,
    route: "/api/teams",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const [users, invites] = await Promise.all([
      getUsersByTenant(authContext!.tenantId),
      getTeamInvites(authContext!.tenantId),
    ]);

    return NextResponse.json(
      successResponse(
        {
          members: users.map((user) => ({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
            status: user.status,
            timezone: user.timezone,
            createdAt: user.created_at,
          })),
          invites: invites.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expires_at,
            createdAt: invite.created_at,
          })),
          summary: {
            memberCount: users.length,
            pendingInviteCount: invites.length,
          },
        },
        requestId,
      ),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch teams.";

    logger.error("List teams request failed", {
      requestId,
      route: "/api/teams",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ERROR",
          message,
          requestId,
        },
      },
      { status: 400 },
    );
  }
}

export async function POST() {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Unsupported team create request", {
    requestId,
    route: "/api/teams",
  });

  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message:
          "Create teams is no longer supported. Invite teammates by email instead.",
        requestId,
      },
    },
    { status: 405 },
  );
}
