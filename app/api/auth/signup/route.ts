import { NextResponse } from "next/server";
import { createTenantAccount } from "@/lib/repositories/authRepository";
import { signupSchema } from "@/lib/validators/auth";
import { createAuthTokens, hashToken } from "@/lib/auth/tokens";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import { buildTenantWorkspaceUrl } from "@/lib/utils/tenant-host";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Signup request started", {
    requestId,
    route: "/api/auth/signup",
  });

  try {
    const body = await request.json();
    const payload = signupSchema.parse(body);

    // Create tenant and first admin user
    const tokenData = {
      refreshTokenHash: await hashToken(crypto.randomUUID()),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const { tenant, user, session } = await createTenantAccount(
      {
        name: payload.companyName,
        slug: payload.companySlug,
        plan: "trial",
        country_code: payload.countryCode,
        gstin: payload.gstin,
        company_address: payload.companyAddress,
      },
      {
        email: payload.email,
        password: payload.password,
        firstName: payload.firstName,
        lastName: payload.lastName,
        timezone: payload.timezone,
      },
      tokenData,
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

    logger.info("Signup workspace URL computed", {
      requestId,
      route: "/api/auth/signup",
      tenantSlug: tenant.slug,
      workspaceUrl,
    });

    const response = NextResponse.json(
      {
        ok: true,
        message: "Workspace created successfully.",
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
      { status: 201 },
    );

    const accessCookieOptions = createAuthCookieOptions(
      request,
      7 * 24 * 60 * 60,
    );
    const refreshCookieOptions = createAuthCookieOptions(
      request,
      30 * 24 * 60 * 60,
    );

    logger.info("Signup cookie options resolved", {
      requestId,
      route: "/api/auth/signup",
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

    logger.info("Signup request completed", {
      requestId,
      route: "/api/auth/signup",
      tenantId: tenant.id,
      userId: user.id,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create workspace.";
    const status =
      message.includes("exists") || message.includes("match") ? 409 : 400;

    logger.error("Signup request failed", {
      requestId,
      route: "/api/auth/signup",
      status,
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: status === 409 ? "CONFLICT" : "VALIDATION_ERROR",
          message,
          requestId,
        },
      },
      { status },
    );
  }
}
