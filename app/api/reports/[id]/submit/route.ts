import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getReportById,
  submitReport,
} from "@/lib/repositories/reportRepository";
import { createApprovalWorkflow } from "@/lib/repositories/approvalRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * POST /api/reports/[id]/submit
 * Submit a report for approval
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const reportId = (await params).id;

  logger.info("Submit report request started", {
    requestId,
    reportId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    // Check report exists and ownership
    const report = await getReportById(authContext!.tenantId, reportId);
    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 },
      );
    }

    // Only the report owner can submit (or admin)
    if (
      authContext!.role === "employee" &&
      report.userId !== authContext!.userId
    ) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }

    // Can only submit draft reports
    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Report is not in draft status" },
        { status: 400 },
      );
    }

    // Require at least one item
    // This check is done in the repository indirectly,
    // but we might want to add explicit validation here

    const updated = await submitReport(authContext!.tenantId, reportId);

    // Create approval workflow
    const workflow = await createApprovalWorkflow(
      authContext!.tenantId,
      reportId,
    );

    logger.info("Report submitted successfully", {
      requestId,
      reportId,
      userId: authContext!.userId,
      workflowId: workflow.id,
    });

    return NextResponse.json(
      {
        report: updated,
        workflow,
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error("Failed to submit report", {
      requestId,
      reportId,
      error: message,
    });

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
