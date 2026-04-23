import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { JWTPayload } from "jose";

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
 * Extract auth context from request headers or cookies
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

  return {
    requestId,
    userId: payload.userId,
    tenantId: payload.tenantId,
    role: payload.role,
    sessionId: payload.sessionId,
  };
}

/**
 * Get auth context from server component (uses cookies)
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

    return {
      requestId: "",
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
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
