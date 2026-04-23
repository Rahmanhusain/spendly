import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import crypto from "crypto";

export interface TokenPayload extends JWTPayload {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  role: "admin" | "manager" | "employee";
  sessionId: string;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "default-secret-key-change-this",
);

/**
 * Create access and refresh tokens
 */
export async function createAuthTokens(
  payload: TokenPayload,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessExpirySeconds =
    parseInt(process.env.JWT_ACCESS_EXPIRY || "604800") || 604800;
  const refreshExpirySeconds =
    parseInt(process.env.JWT_REFRESH_EXPIRY || "604800") || 604800;
  const accessExpiresAt = new Date(Date.now() + accessExpirySeconds * 1000);
  const refreshExpiresAt = new Date(Date.now() + refreshExpirySeconds * 1000);

  const accessToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(accessExpiresAt)
    .sign(JWT_SECRET);

  const refreshToken = await new SignJWT({
    ...payload,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(refreshExpiresAt)
    .sign(JWT_SECRET);

  return { accessToken, refreshToken };
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    const payload = verified.payload as JWTPayload & Partial<TokenPayload>;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.tenantId !== "string" ||
      typeof payload.tenantSlug !== "string" ||
      (payload.role !== "admin" &&
        payload.role !== "manager" &&
        payload.role !== "employee") ||
      typeof payload.sessionId !== "string"
    ) {
      return null;
    }

    return payload as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Hash token for storage
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}
