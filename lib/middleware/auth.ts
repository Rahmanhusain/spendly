import { jwtVerify } from "jose";
import { cookies } from "next/headers";
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
 * Check the database to confirm the session is still valid and the user
 * is still active. Returns false if the session was revoked or the user
 * was deactivated (e.g. removed from the workspace).
 */
async function isSessionStillValid(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  try {
    const result = await query<{ ok: boolean }>(
      `SELECT (
        EXISTS (
          SELECT 1 FROM user_sessions
          WHERE id = $1
            AND user_id = $2
            AND revoked_at IS NULL
            AND expires_at > NOW()
        )
        AND
        EXISTS (
          SELECT 1 FROM users
          WHERE id = $2
            AND status = 'active'
        )
      ) AS ok`,
      [sessionId, userId],
    );
    return result.rows[0]?.ok === true;
  } catch {
    // If the DB is unreachable, fail closed — deny access.
    return false;
  }
}

async function getCurrentUserRole(
  userId: string,
  tenantId: string,
): Promise<AuthContext["role"] | null> {
  try {
    const result = await query<{
      role: AuthContext["role"];
    }>(
      `SELECT role
       FROM users
       WHERE id = $1
         AND tenant_id = $2
         AND status = 'active'`,
      [userId, tenantId],
    );

    return result.rows[0]?.role ?? null;
  } catch {
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

  // Confirm the session is not revoked and the user is still active.
  const valid = await isSessionStillValid(payload.sessionId, payload.userId);
  if (!valid) {
    return null;
  }

  const role = await getCurrentUserRole(payload.userId, payload.tenantId);
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
 * Validates the JWT then confirms the session + user are still active in the DB.
 */
export async function getServerAuthContext(): Promise<AuthContext | null> {
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

    // Confirm the session is not revoked and the user is still active.
    const valid = await isSessionStillValid(payload.sessionId, payload.userId);
    if (!valid) {
      return null;
    }

    const role = await getCurrentUserRole(payload.userId, payload.tenantId);
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
}

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
