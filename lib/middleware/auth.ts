import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cache } from "react";
import type { JWTPayload } from "jose";
import { query } from "@/lib/db/client";

export interface AuthPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  role: "employee" | "manager" | "admin";
  sessionId: string;
}

export interface AuthContext {
  requestId: string;
  userId: string;
  tenantId: string;
  role: "employee" | "manager" | "admin";
  sessionId: string;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-key-change-this",
);

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as AuthPayload;
  } catch {
    return null;
  }
}

/**
 * Single-query auth check: confirms the session is not revoked, the user is
 * still active, the tenant is active, and returns the user's current role —
 * all in one round-trip.
 */
async function validateSessionAndGetRole(
  sessionId: string,
  userId: string,
  tenantId: string,
): Promise<AuthContext["role"] | null> {
  try {
    const result = await query<{ role: AuthContext["role"] }>(
      `SELECT u.role
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN tenants t ON t.id = u.tenant_id
       WHERE s.id = $1
         AND s.user_id = $2
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
         AND u.tenant_id = $3
         AND u.status = 'active'
         AND t.status = 'active'`,
      [sessionId, userId, tenantId],
    );

    return result.rows[0]?.role ?? null;
  } catch {
    // If the DB is unreachable, fail closed — deny access.
    return null;
  }
}

/**
 * Extract auth context from request headers or cookies.
 * Validates the JWT then confirms the session + user are still active in the DB.
 */
export async function extractAuthContext(
  request: Request,
  requestId: string,
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie");
  const headerCookieToken = cookieHeader
    ? cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("accessToken="))
        ?.slice("accessToken=".length)
    : undefined;

  const cookieStore = await cookies();
  const storeCookieToken = cookieStore.get("accessToken")?.value;

  const cookieToken = headerCookieToken || storeCookieToken;

  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : cookieToken;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return null;
  }

  const role = await validateSessionAndGetRole(
    payload.sessionId,
    payload.userId,
    payload.tenantId,
  );
  if (!role) {
    return null;
  }

  return {
    requestId,
    userId: payload.userId,
    tenantId: payload.tenantId,
    role,
    sessionId: payload.sessionId,
  };
}

/**
 * Get auth context from a server component (uses cookies).
 * Wrapped with React cache() so multiple Server Components in the same
 * render pass share a single DB round-trip — the layout and page both call
 * this but the DB query only runs once per request.
 */
export const getServerAuthContext = cache(
  async (): Promise<AuthContext | null> => {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("accessToken")?.value;

      if (!token) {
        return null;
      }

      const payload = await verifyToken(token);

      if (!payload) {
        return null;
      }

      const role = await validateSessionAndGetRole(
        payload.sessionId,
        payload.userId,
        payload.tenantId,
      );
      if (!role) {
        return null;
      }

      return {
        requestId: "",
        userId: payload.userId,
        tenantId: payload.tenantId,
        role,
        sessionId: payload.sessionId,
      };
    } catch {
      return null;
    }
  },
);

/**
 * Type guard for role check
 */
export function hasRole(
  authContext: AuthContext,
  ...allowedRoles: Array<"employee" | "manager" | "admin">
): boolean {
  return allowedRoles.includes(authContext.role);
}

/**
 * Enforce auth and role requirements
 */
interface ErrorWithStatus extends Error {
  status?: number;
}

export function requireAuth(
  authContext: AuthContext | null,
  ...requiredRoles: Array<"employee" | "manager" | "admin">
): AuthContext {
  if (!authContext) {
    const error: ErrorWithStatus = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  if (requiredRoles.length > 0 && !hasRole(authContext, ...requiredRoles)) {
    const error: ErrorWithStatus = new Error("Forbidden");
    error.status = 403;
    throw error;
  }

  return authContext;
}

/**
 * Standard error response for API routes
 */
export function errorResponse(
  message: string,
  status: number = 400,
  requestId?: string,
) {
  return {
    ok: false,
    error: {
      code:
        status === 401
          ? "UNAUTHORIZED"
          : status === 403
            ? "FORBIDDEN"
            : "ERROR",
      message,
      requestId,
    },
  };
}

/**
 * Standard success response for API routes
 */
export function successResponse<T>(data: T, requestId?: string) {
  return {
    ok: true,
    data,
    requestId,
  };
}
