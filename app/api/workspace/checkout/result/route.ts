import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Cashfree, CFEnvironment } from "cashfree-pg";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import { activateSubscription } from "@/lib/subscription/activate";
import logger from "@/lib/utils/logger";
import { sendEmail } from "@/lib/utils/mailer";
import { getUserById, getTenantById } from "@/lib/repositories/authRepository";

export const runtime = "nodejs";

function getCashfreeClient() {
  const env =
    process.env.CASHFREE_ENV === "production"
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;
  const cf = new Cashfree(
    env,
    process.env.CASHFREE_APP_ID!,
    process.env.CASHFREE_SECRET_KEY!,
  );
  return cf;
}

export async function GET(request: NextRequest) {
  const requestId = `req_${crypto.randomUUID()}`;
  const base = request.nextUrl.origin;

  try {
    const authContext = await getServerAuthContext();
    if (!authContext) {
      return NextResponse.redirect(new URL("/login", base));
    }

    const orderId = request.nextUrl.searchParams.get("order_id");
    if (!orderId) {
      return NextResponse.redirect(new URL("/workspace/checkout/failed", base));
    }

    const cashfree = getCashfreeClient();
    const cfResponse = await cashfree.PGFetchOrder(orderId);
    const cfData = cfResponse.data as {
      order_status: string;
      order_id: string;
      order_tags?: { tenant_id?: string; subscription_plan?: string };
    };

    if (cfData.order_status !== "PAID") {
      logger.info("Order not paid on result redirect", {
        requestId,
        orderId,
        status: cfData.order_status,
      });
      return NextResponse.redirect(new URL("/workspace/checkout/failed", base));
    }

    // Look up local order for plan info (fallback if tags missing)
    const orderResult = await query<{ plan: string }>(
      `SELECT plan FROM subscription_orders WHERE cashfree_order_id = $1`,
      [orderId],
    );

    const plan = (cfData.order_tags?.subscription_plan ??
      orderResult.rows[0]?.plan) as "monthly" | "quarterly" | undefined;
    const tenantId = cfData.order_tags?.tenant_id ?? authContext.tenantId;

    if (plan === "monthly" || plan === "quarterly") {
      // Idempotent — safe if webhook already fired
      await activateSubscription(tenantId, plan, orderId);
      logger.info("Subscription activated via result redirect", {
        requestId,
        tenantId,
        plan,
      });

      try {
        // Fetch order details (amount, payment id, timestamps)
        const orderRes = await query<{
          amount: number;
          cashfree_payment_id: string | null;
          created_at: string;
        }>(
          `SELECT amount, cashfree_payment_id, created_at FROM subscription_orders WHERE cashfree_order_id = $1`,
          [orderId],
        );

        const orderRow = orderRes.rows[0];

        // Fetch user details for the currently-logged-in user who made payment
        const user = await getUserById(authContext.userId);
        // Fetch tenant/workspace name for display
        const tenant = await getTenantById(tenantId);

        if (user) {
          const userName =
            `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
            user.email;

          await sendEmail({
            to: user.email,
            from: `Spendly Billing <billing@spendly.software>`,
            subject: `Payment receipt — ${orderId}`,
            templateName: "billing",
            templateData: {
              appName: "Spendly",
              userName,
              orderId,
              plan,
              amount: orderRow?.amount ?? undefined,
              paymentId: orderRow?.cashfree_payment_id ?? undefined,
              paymentDate: orderRow?.created_at ?? new Date().toISOString(),
              workspaceName: tenant?.name ?? undefined,
              tenantId: tenantId,
            },
          });

          logger.info("Billing email sent to payer via result redirect", {
            requestId,
            userId: user.id,
            to: user.email,
            orderId,
          });
        }
      } catch (err) {
        logger.error("Failed to send billing email after payment", {
          requestId,
          error: err instanceof Error ? err.message : String(err),
          orderId,
        });
      }
    }

    return NextResponse.redirect(
      new URL("/workspace/checkout/success?refresh=1", base),
    );
  } catch (error) {
    logger.error("Checkout result handler error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL("/workspace/checkout/failed", base));
  }
}
