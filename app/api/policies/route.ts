import { NextResponse } from "next/server";
import { z } from "zod";
import {
  extractAuthContext,
  requireAuth,
  successResponse,
} from "@/lib/middleware/auth";
import {
  getDefaultPolicyForTenant,
  upsertDefaultPolicyForTenant,
} from "@/lib/repositories/policyRepository";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

const savePolicySchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).optional(),
  rules: z
    .record(z.string(), z.unknown())
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one policy rule is required.",
    }),
});

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Policy fetch request started", {
    requestId,
    route: "/api/policies",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const policy = await getDefaultPolicyForTenant(authContext!.tenantId);

    return NextResponse.json(
      successResponse(
        {
          policy,
          hasPolicy: Boolean(policy),
        },
        requestId,
      ),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch policy.";

    logger.error("Policy fetch request failed", {
      requestId,
      route: "/api/policies",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ERROR",
          message,
          requestId,
        },
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Policy save request started", {
    requestId,
    route: "/api/policies",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin", "manager");

    const body = await request.json();
    const payload = savePolicySchema.parse(body);

    const policy = await upsertDefaultPolicyForTenant(
      authContext!.tenantId,
      authContext!.userId,
      payload,
    );

    return NextResponse.json(
      successResponse(
        {
          policy,
          message: "Policy saved successfully.",
        },
        requestId,
      ),
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save policy.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : 400;

    logger.error("Policy save request failed", {
      requestId,
      route: "/api/policies",
      status,
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "ERROR",
          message,
          requestId,
        },
      },
      { status },
    );
  }
}
