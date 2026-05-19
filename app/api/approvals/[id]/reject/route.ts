/**
 * POST /api/approvals/[id]/reject
 * Manager/admin rejects a report via the approval workflow.
 *
 * Notification: notifyReportRejected → report owner (in_app + email)
 */

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
import { notifyReportRejected } from "@/lib/utils/notifications";
import { query } from "@/lib/db/client";
import { sendEmail } from "@/lib/utils/mailer";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const approvalId = (await params).id;

  logger.info("Reject report (approval workflow) request started", {
    requestId,
    approvalId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "manager", "admin");

    const body = await request.json();
    const { comments } = body;

    if (!comments || typeof comments !== "string" || comments.trim().length === 0) {
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

    logger.info("Report rejected successfully via approval workflow", {
      requestId,
      approvalId,
      reportId: workflow.reportId,
    });

    // ── Notify report owner (in_app + email) ─────────────────────────────────
    // Only notify if the approver is not the report owner (self-rejection guard).
    const report = await getReportById(authContext!.tenantId, workflow.reportId);
    if (report && report.userId && report.userId !== authContext!.userId) {
      // Look up owner email for the email channel
      const emailRow = await query<{ email: string }>(
        `SELECT email FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
        [report.userId, authContext!.tenantId],
      ).catch(() => ({ rows: [] as { email: string }[] }));

      await notifyReportRejected({
        tenantId: authContext!.tenantId,
        ownerId: report.userId,
        ownerEmail: emailRow.rows[0]?.email ?? null,
        reportId: workflow.reportId,
        reportTitle: report.title,
        reason: comments,
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json(
      { workflow: updatedWorkflow, report: updatedReport },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to reject report via approval workflow", {
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
