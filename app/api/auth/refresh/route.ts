import { NextResponse } from "next/server";
import { createAuthTokens, verifyToken } from "@/lib/auth/tokens";
import { getTenantById } from "@/lib/repositories/authRepository";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Refresh request started", {
    requestId,
    route: "/api/auth/refresh",
  });

  try {
    const body = await request.json().catch(() => null);
    const token = body?.refreshToken;

    if (typeof token !== "string" || token.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MISSING_TOKEN",
            message: "Refresh token is required.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid or expired refresh token.",
            requestId,
          },
        },
        { status: 401 },
      );
    }

    const tenant = await getTenantById(payload.tenantId);

    if (!tenant) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "TENANT_NOT_FOUND",
            message: "Workspace not found.",
            requestId,
          },
        },
        { status: 404 },
      );
    }

    const tokens = await createAuthTokens({
      userId: payload.userId,
      tenantId: payload.tenantId,
      tenantSlug: tenant.slug,
      role: payload.role,
      sessionId: payload.sessionId,
    });

    const response = NextResponse.json(
      {
        ok: true,
        message: "Session refreshed.",
        requestId,
        tokens,
      },
      { status: 200 },
    );

    response.cookies.set(
      "accessToken",
      tokens.accessToken,
      createAuthCookieOptions(request, 7 * 24 * 60 * 60),
    );

    logger.info("Refresh request completed", {
      requestId,
      route: "/api/auth/refresh",
      userId: payload.userId,
      tenantId: payload.tenantId,
    });

    return response;
  } catch {
    logger.error("Refresh request failed", {
      requestId,
      route: "/api/auth/refresh",
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "REFRESH_ERROR",
          message: "Unable to refresh session.",
          requestId,
        },
      },
      { status: 401 },
    );
  }
}
