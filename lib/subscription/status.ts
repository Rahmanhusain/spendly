export type WorkspaceStatus =
  | "active"
  | "trial_expired"
  | "subscription_expired";

export type SubscriptionTenant = {
  plan: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
};

/**
 * Pure function — no DB calls.
 * Derives the workspace access status from the tenant record.
 */
export function getWorkspaceStatus(
  tenant: SubscriptionTenant,
): WorkspaceStatus {
  const now = Date.now();

  if (tenant.plan === "subscribed") {
    if (!tenant.subscription_ends_at) return "subscription_expired";
    return new Date(tenant.subscription_ends_at).getTime() > now
      ? "active"
      : "subscription_expired";
  }

  if (tenant.plan === "trial") {
    if (!tenant.trial_ends_at) return "trial_expired";
    return new Date(tenant.trial_ends_at).getTime() > now
      ? "active"
      : "trial_expired";
  }

  // plan === 'expired' or any unknown value
  return "subscription_expired";
}

/**
 * Returns true when the workspace is in read-only mode.
 */
export function isWorkspaceReadOnly(tenant: SubscriptionTenant): boolean {
  return getWorkspaceStatus(tenant) !== "active";
}

import { query } from "@/lib/db/client";

/**
 * Checks derived status and, if expired, updates the tenant record to
 * set `plan = 'expired'` in the database. Returns the derived status.
 *
 * This is intentionally async because it may persist a change.
 */
export async function ensurePlanExpiry(
  tenantId: string,
  tenant: SubscriptionTenant,
): Promise<WorkspaceStatus> {
  const status = getWorkspaceStatus(tenant);

  if (status !== "active" && tenant.plan !== "expired") {
    await query(
      `UPDATE tenants SET plan = 'expired', updated_at = NOW() WHERE id = $1 AND plan != 'expired'`,
      [tenantId],
    );
  }

  return status;
}

/**
 * Returns the number of days remaining until expiry (trial or subscription).
 * Returns null if no expiry date is available.
 */
export function getDaysLeft(tenant: SubscriptionTenant): number | null {
  const expiryStr =
    tenant.plan === "subscribed"
      ? tenant.subscription_ends_at
      : tenant.trial_ends_at;

  if (!expiryStr) return null;

  const diff = new Date(expiryStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
