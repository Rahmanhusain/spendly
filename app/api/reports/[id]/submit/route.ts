import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getReportById,
  submitReport,
} from "@/lib/repositories/reportRepository";
import { createApprovalWorkflow } from "@/lib/repositories/approvalRepository";
import {
  logReportStatusChange,
} from "@/lib/repositories/auditRepository";
import { sendNotification } from "@/lib/utils/notifications";
import { sendEmail } from "@/lib/utils/mailer";
import { query } from "@/lib/db/client";
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

    // Allow submitting from draft (initial) and info_requested (employee response).
    const canSubmitFromStatuses: Array<"draft" | "info_requested"> = [
      "draft",
      "info_requested",
    ];
    if (
      report.status !== "draft" &&
      report.status !== "info_requested"
    ) {
      return NextResponse.json(
        { error: "Report cannot be submitted from this status" },
        { status: 400 },
      );
    }

    const updated = await submitReport(authContext!.tenantId, reportId, [
      report.status === "info_requested" ? "info_requested" : "draft",
    ]);

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

    // Audit status transition
    await logReportStatusChange(
      authContext!.tenantId,
      reportId,
      authContext!.userId,
      report.status,
      "submitted",
      { title: report.title },
    );

    // Notify managers/admins that the report is ready for review.
    const managers = await query<{ id: string; email: string }>(
      `SELECT id::text as id, email
       FROM users
       WHERE tenant_id = $1 AND role IN ('manager', 'admin') AND status = 'active'`,
      [authContext!.tenantId],
    );

    await Promise.all(
      managers.rows.map(async (manager) => {
        await sendNotification({
          tenantId: authContext!.tenantId,
          userId: manager.id,
          channel: "in_app",
          title: `Report submitted: "${report.title}"`,
          message: "An expense report was submitted and needs review.",
          relatedType: "expense_report",
          relatedId: reportId,
        });

        if (manager.email) {
          await sendEmail({
            to: manager.email,
            subject: `Expense report submitted: ${report.title}`,
            text: `Your team has a new expense report awaiting approval: "${report.title}".`,
          });
        }
      }),
    );

    return NextResponse.json(
      updated,
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
