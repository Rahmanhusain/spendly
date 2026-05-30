import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { buildTenantWorkspaceUrl } from "@/lib/utils/tenant-host";
import { createAuthCookieOptions } from "@/lib/auth/cookies";

// ── Secrets ───────────────────────────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-key-change-this",
);

// ── Route sets ────────────────────────────────────────────────────────────────
// Tenant auth: redirect to workspace if already logged in
const AUTH_REDIRECT_ROUTES = new Set(["/", "/login", "/sign-up"]);
const INVITE_MANAGER_ROUTES = new Set([
  "/workspace/team-setup",
  "/workspace/invites",
]);

interface TenantTokenPayload {
  tenantSlug?: string;
  role?: "employee" | "manager" | "admin";
}

function redirectThroughLogout(
  request: NextRequest,
  nextPath = "/",
): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/api/auth/logout?next=${encodeURIComponent(nextPath)}`,
      request.url,
    ),
  );
}

function getAdminPanelOrigin(): string | null {
  const raw =
    process.env.ADMIN_PANEL_ORIGIN ||
    process.env.NEXT_PUBLIC_ADMIN_PANEL_ORIGIN;

  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function buildAdminPanelRedirect(request: NextRequest): URL | null {
  const origin = getAdminPanelOrigin();
  if (!origin) {
    return null;
  }

  const adminPath = request.nextUrl.pathname.slice("/admin".length) || "/";
  const target = new URL(origin);
  target.pathname = adminPath.startsWith("/") ? adminPath : `/${adminPath}`;
  target.search = request.nextUrl.search;
  return target;
}

// ── Main proxy ────────────────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Admin panel bridge — /admin/* ───────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const redirectUrl = buildAdminPanelRedirect(request);
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl);
    }

    // Fall through if the admin panel origin is not configured.
    return NextResponse.next();
  }

  // ── 2. Tenant workspace routing ────────────────────────────────────────────
  const accessToken = request.cookies.get("accessToken")?.value;

  // Redirect already-logged-in users away from auth pages
  if (accessToken && AUTH_REDIRECT_ROUTES.has(pathname)) {
    try {
      const { payload } = await jwtVerify(accessToken, JWT_SECRET);
      const p = payload as TenantTokenPayload;

      if (typeof p.tenantSlug === "string" && p.tenantSlug.length > 0) {
        const workspaceUrl = buildTenantWorkspaceUrl(
          p.tenantSlug,
          request.url,
          process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN,
        );
        if (workspaceUrl !== request.url) {
          return NextResponse.redirect(workspaceUrl);
        }
      }
    } catch {
      // Stale token — clear it via logout before sending the user back home.
      return redirectThroughLogout(request);
    }

    // Valid token but no tenantSlug — fall back to /workspace
    const fallback = new URL("/workspace", request.url);
    if (fallback.toString() !== request.url) {
      return NextResponse.redirect(fallback);
    }
  }

  // Protect invite/manager routes
  if (INVITE_MANAGER_ROUTES.has(pathname)) {
    if (!accessToken) {
      return redirectThroughLogout(request);
    }

    try {
      const { payload } = await jwtVerify(accessToken, JWT_SECRET);
      const p = payload as TenantTokenPayload;
      if (p.role !== "admin" && p.role !== "manager") {
        return NextResponse.redirect(new URL("/workspace", request.url));
      }
    } catch {
      return redirectThroughLogout(request);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
