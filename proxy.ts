import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import { buildTenantWorkspaceUrl } from "@/lib/utils/tenant-host";

const AUTH_REDIRECT_ROUTES = new Set(["/", "/login", "/sign-up"]);
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-key-change-this",
);

interface MiddlewareTokenPayload {
  tenantSlug?: string;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("accessToken")?.value;
  const requestId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? `mw_${globalThis.crypto.randomUUID()}`
      : `mw_${Date.now().toString()}`;

  console.info("[Middleware] Request received", {
    requestId,
    pathname,
    host: request.nextUrl.host,
    hasAccessToken: Boolean(accessToken),
  });

  if (accessToken && AUTH_REDIRECT_ROUTES.has(pathname)) {
    try {
      const verified = await jwtVerify(accessToken, JWT_SECRET);
      const payload = verified.payload as MiddlewareTokenPayload;

      console.info("[Middleware] Token verified", {
        requestId,
        pathname,
        tenantSlug: payload.tenantSlug,
      });

      if (
        typeof payload.tenantSlug === "string" &&
        payload.tenantSlug.length > 0
      ) {
        const tenantWorkspaceUrl = buildTenantWorkspaceUrl(
          payload.tenantSlug,
          request.url,
          process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN,
        );

        console.info("[Middleware] Tenant workspace URL computed", {
          requestId,
          pathname,
          tenantWorkspaceUrl,
        });

        if (tenantWorkspaceUrl !== request.url) {
          console.info("[Middleware] Redirecting to tenant workspace", {
            requestId,
            from: request.url,
            to: tenantWorkspaceUrl,
          });
          return NextResponse.redirect(tenantWorkspaceUrl);
        }
      }
    } catch (error) {
      console.warn("[Middleware] Token verification failed", {
        requestId,
        pathname,
        message: error instanceof Error ? error.message : String(error),
      });

      const response = NextResponse.next();
      response.cookies.set(
        "accessToken",
        "",
        createAuthCookieOptions(request, 0),
      );

      console.info("[Middleware] Cleared stale auth cookie", {
        requestId,
        pathname,
      });

      return response;
    }

    const workspaceUrl = request.nextUrl.clone();
    workspaceUrl.pathname = "/workspace";
    workspaceUrl.search = "";

    if (workspaceUrl.toString() !== request.url) {
      console.info("[Middleware] Redirecting to workspace fallback", {
        requestId,
        from: request.url,
        to: workspaceUrl.toString(),
      });
      return NextResponse.redirect(workspaceUrl);
    }
  }

  console.info("[Middleware] Passing through request", {
    requestId,
    pathname,
  });

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/sign-up"],
};
