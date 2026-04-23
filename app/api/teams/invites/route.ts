import { NextResponse } from "next/server";
import {
  extractAuthContext,
  requireAuth,
  successResponse,
} from "@/lib/middleware/auth";
import {
  createTeamInvite,
  getTeamInvites,
} from "@/lib/repositories/teamRepository";
import logger from "@/lib/utils/logger";
import { z } from "zod";
import crypto from "crypto";

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["employee", "manager", "admin"]),
});

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Create invite request started", {
    requestId,
    route: "/api/teams/invites",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin", "manager");

    const body = await request.json();
    const { email, role } = createInviteSchema.parse(body);

    const expiryMs = parseInt(process.env.INVITE_TOKEN_EXPIRY || "604800000");
    const { invite, token } = await createTeamInvite(
      authContext!.tenantId,
      authContext!.userId,
      email,
      role,
      expiryMs,
    );

    // In production, you would send the invite link via email
    // For now, return the token so it can be used
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite?id=${invite.id}&token=${token}`;

    return NextResponse.json(
      successResponse(
        {
          invite: {
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expires_at,
          },
          inviteLink,
        },
        requestId,
      ),
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invite.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : 400;

    logger.error("Create invite request failed", {
      requestId,
      route: "/api/teams/invites",
      status,
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
      { status },
    );
  }
}

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("List invites request started", {
    requestId,
    route: "/api/teams/invites",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin");

    const invites = await getTeamInvites(authContext!.tenantId);

    return NextResponse.json(
      successResponse(
        {
          invites: invites.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            expiresAt: i.expires_at,
            createdAt: i.created_at,
          })),
        },
        requestId,
      ),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch invites.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : 400;

    logger.error("List invites request failed", {
      requestId,
      route: "/api/teams/invites",
      status,
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
      { status },
    );
  }
}
