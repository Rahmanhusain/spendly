import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getReportById,
  addReceiptToReport,
} from "@/lib/repositories/reportRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * POST /api/reports/[id]/items
 * Add a receipt to a report
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const reportId = (await params).id;

  logger.info("Add receipt to report request started", {
    requestId,
    reportId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    // Check report ownership/access
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

    const body = await request.json();
    const { receiptId } = body;

    if (!receiptId || typeof receiptId !== "string") {
      return NextResponse.json(
        { error: "receiptId is required and must be a string" },
        { status: 400 },
      );
    }

    const item = await addReceiptToReport(
      authContext!.tenantId,
      reportId,
      receiptId,
    );

    logger.info("Receipt added to report successfully", {
      requestId,
      reportId,
      receiptId,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message.includes("not found") || message.includes("Receipt already")
        ? 400
        : 500;

    logger.error("Failed to add receipt to report", {
      requestId,
      reportId,
      error: message,
    });

    return NextResponse.json({ error: message }, { status });
  }
}
