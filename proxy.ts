import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import { buildTenantWorkspaceUrl } from "@/lib/utils/tenant-host";

// ── Secrets ───────────────────────────────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-key-change-this",
);
const ADMIN_JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "admin-default-secret-change-this",
);

// ── Route sets ────────────────────────────────────────────────────────────────
// Tenant auth: redirect to workspace if already logged in
const AUTH_REDIRECT_ROUTES = new Set(["/", "/login", "/sign-up"]);
// Require admin/manager role
const INVITE_MANAGER_ROUTES = new Set(["/team-setup", "/workspace/invites"]);

interface TenantTokenPayload {
  tenantSlug?: string;
  role?: "employee" | "manager" | "admin";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function isValidAdminToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, ADMIN_JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// ── Main proxy ────────────────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Admin panel — /admin/* ──────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const adminToken = request.cookies.get("adminAccessToken")?.value;

    // /admin/login is always accessible (but redirect away if already authed)
    if (pathname === "/admin/login") {
      if (adminToken && (await isValidAdminToken(adminToken))) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }

    // All other /admin/* routes require a valid admin token
    if (!adminToken || !(await isValidAdminToken(adminToken))) {
      const loginUrl = new URL("/admin/login", request.url);
      const response = NextResponse.redirect(loginUrl);
      // Clear stale cookie if present
      if (adminToken) {
        response.cookies.set("adminAccessToken", "", { maxAge: 0, path: "/" });
      }
      return response;
    }

    // Authenticated — pass through
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
      // Stale token — clear it and let the user through to the auth page
      const response = NextResponse.next();
      response.cookies.set("accessToken", "", createAuthCookieOptions(request, 0));
      return response;
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
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(accessToken, JWT_SECRET);
      const p = payload as TenantTokenPayload;
      if (p.role !== "admin" && p.role !== "manager") {
        return NextResponse.redirect(new URL("/workspace", request.url));
      }
    } catch {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set("accessToken", "", createAuthCookieOptions(request, 0));
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
