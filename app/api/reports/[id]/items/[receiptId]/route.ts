import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getReportById,
  removeReceiptFromReport,
} from "@/lib/repositories/reportRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * DELETE /api/reports/[id]/items/[receiptId]
 * Remove a receipt from a report
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; receiptId: string }> },
) {
  const { id, receiptId } = await params;
  const requestId = `req_${crypto.randomUUID()}`;
  const reportId = id;

  logger.info("Remove receipt from report request started", {
    requestId,
    reportId,
    receiptId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    // Check report ownership
    const report = await getReportById(authContext!.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (
      authContext!.role === "employee" &&
      report.userId !== authContext!.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await removeReceiptFromReport(authContext!.tenantId, reportId, receiptId);

    logger.info("Receipt removed from report successfully", {
      requestId,
      reportId,
      receiptId,
    });

    return NextResponse.json({ message: "Receipt removed" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("not found") ? 400 : 500;

    logger.error("Failed to remove receipt from report", {
      requestId,
      reportId,
      receiptId,
      error: message,
    });

    return NextResponse.json({ error: message }, { status });
  }
}
