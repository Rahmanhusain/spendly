import { NextResponse } from "next/server";
import {
  getUserByEmailAndVerifyPassword,
  createSession,
} from "@/lib/repositories/authRepository";
import { loginSchema } from "@/lib/validators/auth";
import { createAuthTokens, hashToken } from "@/lib/auth/tokens";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import { buildTenantWorkspaceUrl } from "@/lib/utils/tenant-host";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Login request started", { requestId, route: "/api/auth/login" });

  try {
    const body = await request.json();
    const payload = loginSchema.parse(body);

    // Find user and verify password
    const result = await getUserByEmailAndVerifyPassword(
      payload.email,
      payload.password,
    );

    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Invalid email or password.",
            requestId,
          },
        },
        { status: 401 },
      );
    }

    const { user, tenant } = result;

    // Create session
    const refreshTokenValue = crypto.randomUUID();
    const refreshTokenHash = await hashToken(refreshTokenValue);
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const session = await createSession(
      tenant.id,
      user.id,
      refreshTokenHash,
      expiresAt,
      request.headers.get("x-forwarded-for") || undefined,
      request.headers.get("user-agent") || undefined,
    );

    // Create JWT tokens
    const tokens = await createAuthTokens({
      userId: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      role: user.role,
      sessionId: session.id,
    });

    const workspaceUrl = buildTenantWorkspaceUrl(
      tenant.slug,
      request.url,
      process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    );

    logger.info("Login workspace URL computed", {
      requestId,
      route: "/api/auth/login",
      tenantSlug: tenant.slug,
      workspaceUrl,
    });

    const response = NextResponse.json(
      {
        ok: true,
        message: "Logged in successfully.",
        requestId,
        tokens,
        workspace: {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            countryCode: tenant.country_code,
          },
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            timezone: user.timezone,
          },
        },
        workspaceUrl,
      },
      { status: 200 },
    );

    const accessCookieOptions = createAuthCookieOptions(
      request,
      7 * 24 * 60 * 60,
    );
    const refreshCookieOptions = createAuthCookieOptions(
      request,
      30 * 24 * 60 * 60,
    );

    logger.info("Login cookie options resolved", {
      requestId,
      route: "/api/auth/login",
      accessCookieDomain: accessCookieOptions.domain ?? "host-only",
      refreshCookieDomain: refreshCookieOptions.domain ?? "host-only",
    });

    response.cookies.set(
      "accessToken",
      tokens.accessToken,
      accessCookieOptions,
    );
    response.cookies.set(
      "refreshToken",
      tokens.refreshToken,
      refreshCookieOptions,
    );

    logger.info("Login request completed", {
      requestId,
      route: "/api/auth/login",
      tenantId: tenant.id,
      userId: user.id,
      sessionId: session.id,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Authentication failed.";

    logger.error("Login request failed", {
      requestId,
      route: "/api/auth/login",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "AUTH_ERROR",
          message,
          requestId,
        },
      },
      { status: 400 },
    );
  }
}
