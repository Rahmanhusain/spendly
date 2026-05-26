import { cookies } from "next/headers";
import { cache } from "react";
import { verifyAdminToken, type AdminTokenPayload } from "@/lib/auth/adminTokens";
import { getValidAdminSession, getSuperAdminById } from "@/lib/repositories/adminRepository";

export interface AdminAuthContext {
  adminId: string;
  sessionId: string;
  name: string;
  email: string;
}

/**
 * Extract and validate admin auth from cookies.
 * Used in API route handlers.
 */
export async function extractAdminAuthContext(
  request: Request
): Promise<AdminAuthContext | null> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const tokenMatch = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("adminAccessToken="));
  const token = tokenMatch?.slice("adminAccessToken=".length);

  if (!token) return null;
  return resolveAdminToken(token);
}

/**
 * Get admin auth context from a Server Component (uses Next.js cookies()).
 * Cached per request.
 */
export const getServerAdminAuthContext = cache(
  async (): Promise<AdminAuthContext | null> => {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("adminAccessToken")?.value;
      if (!token) return null;
      return resolveAdminToken(token);
    } catch {
      return null;
    }
  }
);

async function resolveAdminToken(
  token: string
): Promise<AdminAuthContext | null> {
  const payload = await verifyAdminToken(token);
  if (!payload) return null;

  const session = await getValidAdminSession(payload.sessionId);
  if (!session) return null;

  const admin = await getSuperAdminById(payload.adminId);
  if (!admin || !admin.is_active) return null;

  return {
    adminId: admin.id,
    sessionId: session.id,
    name: admin.name,
    email: admin.email,
  };
}

export function createAdminCookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
