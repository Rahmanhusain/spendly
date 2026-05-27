import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import crypto from "crypto";

export interface AdminTokenPayload extends JWTPayload {
  adminId: string;
  sessionId: string;
  type: "admin_access" | "admin_refresh";
}

function getAdminSecret(): Uint8Array {
  const secret =
    process.env.ADMIN_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "admin-default-secret-change-this";
  return new TextEncoder().encode(secret);
}

export async function createAdminTokens(payload: {
  adminId: string;
  sessionId: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const secret = getAdminSecret();
  const accessExpiry = parseInt(process.env.ADMIN_JWT_ACCESS_EXPIRY || "3600");
  const refreshExpiry = parseInt(
    process.env.ADMIN_JWT_REFRESH_EXPIRY || "86400",
  );

  const base: AdminTokenPayload = {
    adminId: payload.adminId,
    sessionId: payload.sessionId,
    type: "admin_access",
  };

  const accessToken = await new SignJWT(base)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(new Date(Date.now() + accessExpiry * 1000))
    .sign(secret);

  const refreshToken = await new SignJWT({ ...base, type: "admin_refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(new Date(Date.now() + refreshExpiry * 1000))
    .sign(secret);

  return { accessToken, refreshToken };
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminSecret());
    const p = payload as JWTPayload & Partial<AdminTokenPayload>;
    if (typeof p.adminId !== "string" || typeof p.sessionId !== "string") {
      return null;
    }
    return p as AdminTokenPayload;
  } catch {
    return null;
  }
}

export function hashAdminRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
