import crypto from "crypto";
import { NextResponse } from "next/server";
import { Cashfree, CFEnvironment } from "cashfree-pg";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

function parsePlanAmount(value: string | undefined, defaultValue: number) {
  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

const PLAN_AMOUNTS: Record<"monthly" | "quarterly", number> = {
  monthly: parsePlanAmount(process.env.SUBSCRIPTION_MONTHLY_AMOUNT, 999),
  quarterly: parsePlanAmount(process.env.SUBSCRIPTION_QUARTERLY_AMOUNT, 2699),
};

function getCashfreeClient() {
  const env =
    process.env.CASHFREE_ENV === "production"
      ? CFEnvironment.PRODUCTION
      : CFEnvironment.SANDBOX;

  return new Cashfree(
    env,
    process.env.CASHFREE_APP_ID!,
    process.env.CASHFREE_SECRET_KEY!,
  );
}

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const body = await request.json();
    const plan = body?.plan as string;

    if (plan !== "monthly" && plan !== "quarterly") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_PLAN",
            message: "plan must be 'monthly' or 'quarterly'.",
          },
        },
        { status: 400 },
      );
    }

    const [tenant, user] = await Promise.all([
      getTenantById(authContext!.tenantId),
      getUserById(authContext!.userId),
    ]);

    if (!tenant || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "NOT_FOUND", message: "Workspace or user not found." },
        },
        { status: 404 },
      );
    }

    const amount = PLAN_AMOUNTS[plan];
    const orderId = `spendly_${authContext!.tenantId.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

    const cashfree = getCashfreeClient();

    const cfResponse = await cashfree.PGCreateOrder({
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: authContext!.userId,
        customer_email: user.email,
        customer_phone: user.phone_number?.trim() || "9999999999",
      },
      order_meta: {
        return_url: `${baseUrl}/api/workspace/checkout/result?order_id={order_id}`,
        notify_url: `${baseUrl}/api/webhooks/cashfree`,
      },
      order_tags: {
        tenant_id: authContext!.tenantId,
        subscription_plan: plan,
      },
    });

    const cfData = cfResponse.data as {
      payment_session_id: string;
      order_id: string;
    };

    // Persist order in DB
    await query(
      `INSERT INTO subscription_orders
         (tenant_id, cashfree_order_id, plan, amount, status, payment_session_id)
       VALUES ($1, $2, $3, $4, 'created', $5)
       ON CONFLICT (cashfree_order_id) DO NOTHING`,
      [authContext!.tenantId, orderId, plan, amount, cfData.payment_session_id],
    );

    logger.info("Payment initiated", { requestId, orderId, plan, amount });

    return NextResponse.json(
      {
        ok: true,
        data: {
          paymentSessionId: cfData.payment_session_id,
          orderId,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to initiate payment.";
    const status = message.includes("Unauthorized") ? 401 : 500;
    logger.error("Initiate payment failed", { requestId, error: message });
    return NextResponse.json({ ok: false, error: { message } }, { status });
  }
}
