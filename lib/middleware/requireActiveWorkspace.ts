import { NextResponse } from "next/server";
import type { AuthContext } from "@/lib/middleware/auth";
import { getTenantById } from "@/lib/repositories/authRepository";
import { ensurePlanExpiry } from "@/lib/subscription/status";

/**
 * Checks whether the workspace is active (trial valid or subscribed).
 * Returns a 403 NextResponse if the workspace is in read-only mode,
 * or null if access is allowed.
 *
 * Usage in a route handler:
 *   const guard = await requireActiveWorkspace(authContext);
 *   if (guard) return guard;
 */
export async function requireActiveWorkspace(
  authContext: AuthContext,
  requestId?: string,
): Promise<NextResponse | null> {
  const tenant = await getTenantById(authContext.tenantId);

  if (!tenant) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WORKSPACE_NOT_FOUND",
          message: "Workspace not found.",
          requestId,
        },
      },
      { status: 404 },
    );
  }

  const status = await ensurePlanExpiry(tenant.id, tenant);

  if (status !== "active") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WORKSPACE_READONLY",
          reason: status, // 'trial_expired' | 'subscription_expired'
          message:
            "Your workspace is in read-only mode. Please renew your subscription.",
          requestId,
        },
      },
      { status: 403 },
    );
  }

  return null;
}
