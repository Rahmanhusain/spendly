import crypto from "crypto";
import { NextResponse } from "next/server";
import { activateSubscription } from "@/lib/subscription/activate";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

// Cashfree sends the raw body for signature verification — disable body parsing
export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.CASHFREE_WEBHOOK_SECRET;
  if (!secret) return false;

  const payload = timestamp + rawBody;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const rawBody = await request.text();
    const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
    const signature = request.headers.get("x-webhook-signature") ?? "";

    if (!verifySignature(rawBody, timestamp, signature)) {
      logger.warn("Cashfree webhook signature verification failed", { requestId });
      // Still return 200 to avoid Cashfree retries for invalid sig — log and ignore
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const event = JSON.parse(rawBody) as {
      type: string;
      data: {
        order: {
          order_id: string;
          order_tags?: { tenant_id?: string; subscription_plan?: string };
        };
        payment?: { cf_payment_id?: string };
      };
    };

    logger.info("Cashfree webhook received", { requestId, eventType: event.type });

    if (event.type === "PAYMENT_SUCCESS_WEBHOOK") {
      const tenantId = event.data.order?.order_tags?.tenant_id;
      const plan = event.data.order?.order_tags?.subscription_plan as "monthly" | "quarterly" | undefined;
      const orderId = event.data.order?.order_id;
      const paymentId = event.data.payment?.cf_payment_id?.toString();

      if (tenantId && (plan === "monthly" || plan === "quarterly") && orderId) {
        await activateSubscription(tenantId, plan, orderId, paymentId);
        logger.info("Subscription activated via webhook", { requestId, tenantId, plan });
      } else {
        logger.warn("Webhook missing required fields", { requestId, tenantId, plan, orderId });
      }
    }

    // Always acknowledge — Cashfree will retry on non-200
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error("Cashfree webhook processing error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return 200 even on error to prevent infinite retries
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
