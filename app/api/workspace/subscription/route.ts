import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { getTenantById } from "@/lib/repositories/authRepository";
import {
  getWorkspaceStatus,
  getDaysLeft,
} from "@/lib/subscription/status";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const tenant = await getTenantById(authContext!.tenantId);
    if (!tenant) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Workspace not found." } },
        { status: 404 },
      );
    }

    const status = getWorkspaceStatus(tenant);
    const daysLeft = getDaysLeft(tenant);

    logger.info("Subscription status fetched", { requestId, tenantId: authContext!.tenantId, status });

    return NextResponse.json(
      {
        ok: true,
        data: {
          plan: tenant.plan,
          status,
          subscriptionPlan: tenant.subscription_plan ?? null,
          trialEndsAt: tenant.trial_ends_at ?? null,
          subscriptionEndsAt: tenant.subscription_ends_at ?? null,
          daysLeft,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch subscription.";
    const status = message.includes("Unauthorized") ? 401 : 400;
    logger.error("Subscription fetch failed", { requestId, error: message });
    return NextResponse.json({ ok: false, error: { message } }, { status });
  }
}
