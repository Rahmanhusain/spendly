import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { createReceiptComment } from "@/lib/repositories/receiptRepository";
import logger from "@/lib/utils/logger";

const addCommentSchema = z.object({
  receiptId: z.string().uuid(),
  message: z.string().trim().min(1).max(1200),
});

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Receipt comment request started", {
    requestId,
    route: "/api/receipts/comments",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const body = await request.json();
    const payload = addCommentSchema.parse(body);

    const created = await createReceiptComment({
      tenantId: authContext!.tenantId,
      receiptId: payload.receiptId,
      userId: authContext!.userId,
      message: payload.message,
    });

    if (!created) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RECEIPT_NOT_FOUND",
            message: "Receipt not found for this workspace.",
            requestId,
          },
        },
        { status: 404 },
      );
    }

    logger.info("Receipt comment added", {
      requestId,
      route: "/api/receipts/comments",
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
      receiptId: payload.receiptId,
      commentId: created.id,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        data: {
          comment: {
            ...created,
            author: "You",
            authorRole: authContext!.role,
          },
          message: "Comment posted.",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to add comment.";

    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : message.includes("Invalid") || message.includes("uuid")
          ? 400
          : 400;

    logger.error("Receipt comment request failed", {
      requestId,
      route: "/api/receipts/comments",
      status,
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RECEIPT_COMMENT_FAILED",
          message,
          requestId,
        },
      },
      { status },
    );
  }
}
