import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getApprovalWorkflowById,
  rejectApprovalWorkflow,
} from "@/lib/repositories/approvalRepository";
import {
  rejectReport,
  getReportById,
} from "@/lib/repositories/reportRepository";
import { query } from "@/lib/db/client";
import { sendEmail } from "@/lib/utils/mailer";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * POST /api/approvals/[id]/reject
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const approvalId = (await params).id;

  logger.info("Reject report request started", {
    requestId,
    approvalId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "manager", "admin");

    const body = await request.json();
    const { comments } = body;

    if (
      !comments ||
      typeof comments !== "string" ||
      comments.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const workflow = await getApprovalWorkflowById(
      authContext!.tenantId,
      approvalId,
    );

    if (!workflow) {
      return NextResponse.json(
        { error: "Approval workflow not found" },
        { status: 404 },
      );
    }

    if (workflow.status !== "submitted") {
      return NextResponse.json(
        { error: "Workflow is not in submitted state" },
        { status: 400 },
      );
    }

    const updatedWorkflow = await rejectApprovalWorkflow(
      authContext!.tenantId,
      approvalId,
      authContext!.userId,
      comments,
    );

    const updatedReport = await rejectReport(
      authContext!.tenantId,
      workflow.reportId,
      comments,
    );

    logger.info("Report rejected successfully", {
      requestId,
      approvalId,
      reportId: workflow.reportId,
    });

    // Notify report creator (in-app + email) unless the approver is the same user
    try {
      const report = await getReportById(
        authContext!.tenantId,
        workflow.reportId,
      );
      if (report && report.userId && report.userId !== authContext!.userId) {
        // Insert in-app notification
        await query(
          `INSERT INTO notifications (tenant_id, user_id, channel, title, message, related_type, related_id, sent_at, created_at)
           VALUES ($1,$2,'in_app',$3,$4,'expense_report',$5,NOW(),NOW())`,
          [
            authContext!.tenantId,
            report.userId,
            "Report rejected",
            `Your expense report "${report.title}" was rejected: ${comments}`,
            workflow.reportId,
          ],
        );

        // Insert email notification record (for audit) and attempt to send an email
        await query(
          `INSERT INTO notifications (tenant_id, user_id, channel, title, message, related_type, related_id, sent_at, created_at)
           VALUES ($1,$2,'email',$3,$4,'expense_report',$5,NOW(),NOW())`,
          [
            authContext!.tenantId,
            report.userId,
            "Report rejected",
            `Your expense report "${report.title}" was rejected: ${comments}`,
            workflow.reportId,
          ],
        );

        // Send email asynchronously (best-effort)
        try {
          // Look up the user's email
          const userRow = await query(
            `SELECT email FROM users WHERE id = $1 AND tenant_id = $2`,
            [report.userId, authContext!.tenantId],
          );
          const userEmail = userRow.rows[0]?.email as string | undefined;
          if (userEmail) {
            await sendEmail({
              to: userEmail,
              subject: `Expense report rejected: ${report.title}`,
              text: `Your expense report "${report.title}" was rejected by ${authContext!.userId}. Reason: ${comments}`,
            });
          }
        } catch (emailErr) {
          logger.warn("Failed to send rejection email", {
            requestId,
            error:
              emailErr instanceof Error ? emailErr.message : String(emailErr),
          });
        }
      }
    } catch (notifyErr) {
      logger.warn("Failed to create rejection notification", {
        requestId,
        error:
          notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      });
    }

    return NextResponse.json(
      {
        workflow: updatedWorkflow,
        report: updatedReport,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to reject report", {
      requestId,
      approvalId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to reject report" },
      { status: 500 },
    );
  }
}
