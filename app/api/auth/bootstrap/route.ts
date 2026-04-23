import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/tokens";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import { normalizeRootDomain } from "@/lib/utils/tenant-host";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");

  if (!origin) {
    return null;
  }

  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname.toLowerCase();
    const rootDomain = normalizeRootDomain(
      process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    );

    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return origin;
    }

    if (
      rootDomain &&
      (hostname === rootDomain || hostname.endsWith(`.${rootDomain}`))
    ) {
      return origin;
    }

    return null;
  } catch {
    return null;
  }
}

function addCorsHeaders(response: NextResponse, origin: string | null) {
  if (!origin) {
    return;
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");
}

export async function OPTIONS(request: Request) {
  const origin = getAllowedOrigin(request);
  const response = new NextResponse(null, { status: 204 });
  addCorsHeaders(response, origin);
  return response;
}

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  const origin = getAllowedOrigin(request);

  logger.info("Auth bootstrap request started", {
    requestId,
    route: "/api/auth/bootstrap",
    origin,
  });

  try {
    const body = (await request.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };

    if (
      typeof body.accessToken !== "string" ||
      body.accessToken.length === 0 ||
      typeof body.refreshToken !== "string" ||
      body.refreshToken.length === 0
    ) {
      const response = NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_PAYLOAD",
            message: "Access and refresh token are required.",
            requestId,
          },
        },
        { status: 400 },
      );
      addCorsHeaders(response, origin);
      return response;
    }

    const accessPayload = await verifyToken(body.accessToken);
    const refreshPayload = await verifyToken(body.refreshToken);

    if (!accessPayload || !refreshPayload) {
      const response = NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_TOKEN",
            message: "Invalid token provided for bootstrap.",
            requestId,
          },
        },
        { status: 401 },
      );
      addCorsHeaders(response, origin);
      return response;
    }

    if (accessPayload.userId !== refreshPayload.userId) {
      const response = NextResponse.json(
        {
          ok: false,
          error: {
            code: "TOKEN_MISMATCH",
            message: "Bootstrap token mismatch.",
            requestId,
          },
        },
        { status: 401 },
      );
      addCorsHeaders(response, origin);
      return response;
    }

    const response = NextResponse.json(
      {
        ok: true,
        requestId,
        message: "Auth bootstrap completed.",
      },
      { status: 200 },
    );

    response.cookies.set(
      "accessToken",
      body.accessToken,
      createAuthCookieOptions(request, 7 * 24 * 60 * 60),
    );
    response.cookies.set(
      "refreshToken",
      body.refreshToken,
      createAuthCookieOptions(request, 30 * 24 * 60 * 60),
    );

    addCorsHeaders(response, origin);

    logger.info("Auth bootstrap request completed", {
      requestId,
      route: "/api/auth/bootstrap",
      origin,
      tenantId: accessPayload.tenantId,
      userId: accessPayload.userId,
      tenantSlug: accessPayload.tenantSlug,
    });

    return response;
  } catch (error) {
    logger.error("Auth bootstrap request failed", {
      requestId,
      route: "/api/auth/bootstrap",
      message: error instanceof Error ? error.message : "Unknown error",
      error: error instanceof Error ? error.stack : String(error),
    });

    const response = NextResponse.json(
      {
        ok: false,
        error: {
          code: "BOOTSTRAP_ERROR",
          message: "Failed to bootstrap tenant session.",
          requestId,
        },
      },
      { status: 500 },
    );
    addCorsHeaders(response, origin);
    return response;
  }
}
