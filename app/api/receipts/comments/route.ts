import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { createReceiptComment } from "@/lib/repositories/receiptRepository";
import { sendNotification } from "@/lib/utils/notifications";
import { query } from "@/lib/db/client";
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

    // Send notification to receipt owner if commenter is not the owner
    try {
      const receiptResult = await query<{
        user_id: string;
        vendor_name: string | null;
      }>(
        `SELECT user_id, vendor_name FROM receipts 
         WHERE tenant_id = $1 AND id = $2`,
        [authContext!.tenantId, payload.receiptId],
      );

      const receipt = receiptResult.rows[0];

      if (receipt && receipt.user_id !== authContext!.userId) {
        await sendNotification({
          tenantId: authContext!.tenantId,
          userId: receipt.user_id,
          channel: "in_app",
          title: "New comment on your receipt",
          message: `Comment on receipt from ${receipt.vendor_name || "vendor"}: "${payload.message.substring(0, 50)}${payload.message.length > 50 ? "..." : ""}"`,
          relatedType: "receipt",
          relatedId: payload.receiptId,
        });

        logger.info("Receipt comment notification sent", {
          requestId,
          route: "/api/receipts/comments",
          receiptId: payload.receiptId,
          notifiedUserId: receipt.user_id,
        });
      }
    } catch (notificationError) {
      logger.error("Failed to send receipt comment notification", {
        requestId,
        route: "/api/receipts/comments",
        receiptId: payload.receiptId,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
      // Don't fail the comment if notification fails
    }

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
