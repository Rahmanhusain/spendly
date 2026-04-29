import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  approveReport,
} from "@/lib/repositories/reportRepository";
import {
  getApprovalWorkflow,
  approveApprovalWorkflow,
} from "@/lib/repositories/approvalRepository";
import { logReportStatusChange } from "@/lib/repositories/auditRepository";
import { sendNotification } from "@/lib/utils/notifications";
import { sendEmail } from "@/lib/utils/mailer";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * POST /api/reports/[id]/approve
 * Manager/admin approves a submitted expense report.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(
    req,
    `req_${crypto.randomUUID()}`,
  );

  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["manager", "admin"].includes(authContext.role)) {
    return NextResponse.json(
      { error: "Only managers and admins can approve reports" },
      { status: 403 },
    );
  }

  const { id: reportId } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const { comments } = body as { comments?: string };

    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "submitted") {
      return NextResponse.json(
        { error: "Can only approve submitted reports" },
        { status: 400 },
      );
    }

    const workflow = await getApprovalWorkflow(
      authContext.tenantId,
      reportId,
    );
    if (!workflow) {
      return NextResponse.json(
        { error: "Approval workflow not found for this report" },
        { status: 404 },
      );
    }

    // Update workflow and report state.
    await approveApprovalWorkflow(
      authContext.tenantId,
      workflow.id,
      authContext.userId,
      comments,
    );

    const updatedReport = await approveReport(
      authContext.tenantId,
      reportId,
      authContext.userId,
    );

    await logReportStatusChange(
      authContext.tenantId,
      reportId,
      authContext.userId,
      "submitted",
      "approved",
      { workflowId: workflow.id, comments: comments || null },
    );

    // Notify employee in-app (and best-effort email).
    await sendNotification({
      tenantId: authContext.tenantId,
      userId: report.userId,
      channel: "in_app",
      title: `Approved: "${report.title}"`,
      message: `Your expense report was approved by your manager.`,
      relatedType: "expense_report",
      relatedId: reportId,
    });

    try {
      const userEmail = await query<{ email: string }>(
        `SELECT email::text as email FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [report.userId, authContext.tenantId],
      );
      const email = userEmail.rows[0]?.email;
      if (email) {
        await sendEmail({
          to: email,
          subject: `Expense report approved: ${report.title}`,
          text: `Your expense report "${report.title}" has been approved.`,
        });
      }
    } catch (emailErr) {
      logger.warn("Approve email lookup/send failed", {
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }

    return NextResponse.json(updatedReport, { status: 200 });
  } catch (error) {
    logger.error("Failed to approve report", {
      error: error instanceof Error ? error.message : String(error),
      reportId,
    });
    return NextResponse.json(
      { error: "Failed to approve report" },
      { status: 500 },
    );
  }
}

