import { NextResponse } from "next/server";
import {
  getInviteAndVerifyToken,
  createUserFromInvite,
  acceptTeamInvite,
} from "@/lib/repositories/teamRepository";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { extractAuthContext } from "@/lib/middleware/auth";
import { notifyInviteAccepted } from "@/lib/utils/notifications";
import { createAuthTokens } from "@/lib/auth/tokens";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import logger from "@/lib/utils/logger";
import { z } from "zod";
import crypto from "crypto";

const acceptInviteSchema = z.object({
  inviteId: z.string().uuid(),
  token: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: z.string().optional(),
});

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Accept invite request started", {
    requestId,
    route: "/api/teams/invites/accept",
  });

  try {
    const body = await request.json();
    const { inviteId, token, firstName, lastName, password } =
      acceptInviteSchema.parse(body);
    const hasNewUserDetails = Boolean(firstName && password);

    // Verify invite and token
    const invite = await getInviteAndVerifyToken(inviteId, token);

    if (!invite) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_INVITE",
            message: "Invalid or expired invite.",
            requestId,
          },
        },
        { status: 404 },
      );
    }

    // Check if user is already logged in
    const authContext = await extractAuthContext(request, requestId);

    let userId: string;

    if (hasNewUserDetails) {
      // Create new user and accept invite (even if another user is currently logged in)
      const { userId: newUserId } = await createUserFromInvite(
        invite.tenant_id,
        invite.email,
        firstName!,
        lastName,
        password!,
        "Asia/Kolkata",
        invite.role,
      );

      userId = newUserId;
    } else if (authContext) {
      const currentUser = await getUserById(authContext.userId);

      if (!currentUser) {
        throw new Error("Authenticated user not found.");
      }

      if (currentUser.email.toLowerCase() !== invite.email.toLowerCase()) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "INVITE_EMAIL_MISMATCH",
              message:
                "This invite is for a different email. Sign out first or complete firstName and password to create the invited account.",
              requestId,
            },
          },
          { status: 409 },
        );
      }

      // Existing user accepting invite
      userId = authContext.userId;
      await acceptTeamInvite(inviteId, userId);
    } else {
      // New user from invite - needs password and first name
      if (!password || !firstName) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "MISSING_FIELDS",
              message:
                "Password and firstName are required for new users. Last name is optional.",
              requestId,
            },
          },
          { status: 400 },
        );
      }

      // Create new user and accept invite
      const { userId: newUserId } = await createUserFromInvite(
        invite.tenant_id,
        invite.email,
        firstName,
        lastName,
        password,
        "Asia/Kolkata",
        invite.role,
      );

      userId = newUserId;
    }

    // Get user and tenant details
    const user = await getUserById(userId);

    if (!user) {
      throw new Error("Failed to retrieve user after accepting invite.");
    }

    const tenant = await getTenantById(user.tenant_id);

    if (!tenant) {
      throw new Error("Workspace not found for invite acceptance.");
    }

    // Create session and tokens
    const tokens = await createAuthTokens({
      userId: user.id,
      tenantId: user.tenant_id,
      tenantSlug: tenant.slug,
      role: user.role,
      sessionId: crypto.randomUUID(),
    });

    const response = NextResponse.json(
      {
        ok: true,
        message: "Invite accepted successfully.",
        requestId,
        tokens,
        workspace: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            timezone: user.timezone,
          },
        },
      },
      { status: 200 },
    );

    response.cookies.set(
      "accessToken",
      tokens.accessToken,
      createAuthCookieOptions(request, 7 * 24 * 60 * 60),
    );

    response.cookies.set(
      "refreshToken",
      tokens.refreshToken,
      createAuthCookieOptions(request, 30 * 24 * 60 * 60),
    );

    logger.info("Accept invite request completed", {
      requestId,
      route: "/api/teams/invites/accept",
      userId: user.id,
      tenantId: user.tenant_id,
      inviteId,
    });

    // ── Notify the admin/manager who sent the invite ──────────────────────────
    // invite.invited_by is the UUID of the person who created the invite.
    // We fire-and-forget so a notification failure never blocks the login.
    try {
      const acceptedByName = [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

      await notifyInviteAccepted({
        tenantId: user.tenant_id,
        inviterId: invite.invited_by,
        acceptedByEmail: user.email,
        acceptedByName,
      });
    } catch (notifyErr) {
      logger.warn("Failed to send invite-accepted notification", {
        requestId,
        error: notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to accept invite.";
    const status =
      message.includes("not found") || message.includes("Invalid") ? 404 : 400;

    logger.error("Accept invite request failed", {
      requestId,
      route: "/api/teams/invites/accept",
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
