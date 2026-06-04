import { query } from "@/lib/db/client";

/**
 * Idempotent: activates subscription for a tenant after successful payment.
 * Called by both the Cashfree webhook and the return-URL result handler.
 */
export async function activateSubscription(
  tenantId: string,
  plan: "monthly" | "quarterly",
  cashfreeOrderId: string,
  cashfreePaymentId?: string,
): Promise<void> {
  const now = new Date();
  const days = plan === "monthly" ? 30 : 90;
  const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await query(
    `UPDATE tenants SET
       plan                  = 'subscribed',
       subscription_plan     = $2,
       subscription_starts_at = $3,
       subscription_ends_at  = $4,
       subscription_renewed_at = $3,
       updated_at            = NOW()
     WHERE id = $1
       AND (
         plan != 'subscribed'
         OR subscription_ends_at IS NULL
         OR subscription_ends_at < $4
       )`,
    [tenantId, plan, now.toISOString(), endsAt.toISOString()],
  );

  // Update order record
  await query(
    `UPDATE subscription_orders
     SET status = 'paid',
         cashfree_payment_id = $2,
         updated_at = NOW()
     WHERE cashfree_order_id = $1 AND status != 'paid'`,
    [cashfreeOrderId, cashfreePaymentId ?? null],
  );
}
