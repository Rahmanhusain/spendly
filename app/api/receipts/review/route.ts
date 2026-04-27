import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  approveReceiptByManager,
  rejectReceiptByManager,
} from "@/lib/repositories/receiptRepository";
import logger from "@/lib/utils/logger";

const reviewSchema = z.object({
  receiptId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
});

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Receipt review request started", {
    requestId,
    route: "/api/receipts/review",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin", "manager");

    const body = await request.json();
    const payload = reviewSchema.parse(body);

    const updated =
      payload.decision === "approve"
        ? await approveReceiptByManager({
            tenantId: authContext!.tenantId,
            receiptId: payload.receiptId,
          })
        : await rejectReceiptByManager({
            tenantId: authContext!.tenantId,
            receiptId: payload.receiptId,
          });

    if (!updated) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RECEIPT_NOT_FOUND_OR_NOT_REVIEWABLE",
            message: "Receipt was not found or is not in a reviewable status.",
            requestId,
          },
        },
        { status: 404 },
      );
    }

    logger.info("Receipt reviewed by manager/admin", {
      requestId,
      route: "/api/receipts/review",
      receiptId: updated.id,
      decision: payload.decision,
      reviewerUserId: authContext!.userId,
      reviewerRole: authContext!.role,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        data: {
          receipt: updated,
          message:
            payload.decision === "approve"
              ? "Receipt approved. Status moved to verified."
              : "Receipt rejected by manager/admin. Status moved to archived.",
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to review receipt.";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : message.includes("Invalid") || message.includes("uuid")
          ? 400
          : 400;

    logger.error("Receipt review request failed", {
      requestId,
      route: "/api/receipts/review",
      status,
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RECEIPT_REVIEW_FAILED",
          message,
          requestId,
        },
      },
      { status },
    );
  }
}
