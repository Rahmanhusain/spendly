import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getApprovalWorkflowById,
  rejectApprovalWorkflow,
} from "@/lib/repositories/approvalRepository";
import { rejectReport } from "@/lib/repositories/reportRepository";
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

    logger.info("Report rejected successfully", {
      requestId,
      approvalId,
      reportId: workflow.reportId,
    });

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
