import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  rejectReport,
} from "@/lib/repositories/reportRepository";
import {
  getApprovalWorkflow,
  rejectApprovalWorkflow,
} from "@/lib/repositories/approvalRepository";
import { logReportStatusChange } from "@/lib/repositories/auditRepository";
import { notifyReportRejected } from "@/lib/utils/notifications";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * POST /api/reports/[id]/reject
 * Manager/admin rejects a submitted expense report (returns report to draft).
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
      { error: "Only managers and admins can reject reports" },
      { status: 403 },
    );
  }

  const { id: reportId } = await params;

  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason?.trim();

    if (!reason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 },
      );
    }

    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "submitted") {
      return NextResponse.json(
        { error: "Can only reject submitted reports" },
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

    await rejectApprovalWorkflow(
      authContext.tenantId,
      workflow.id,
      authContext.userId,
      reason,
    );

    const updatedReport = await rejectReport(
      authContext.tenantId,
      reportId,
      reason,
    );

    // Audit the status transition.
    await logReportStatusChange(
      authContext.tenantId,
      reportId,
      authContext.userId,
      "submitted",
      "rejected",
      { workflowId: workflow.id, reason },
    );

    // ── Notify report owner (in_app + email) ─────────────────────────────────
    const ownerEmailRow = await query<{ email: string }>(
      `SELECT email::text as email FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [report.userId, authContext.tenantId],
    ).catch(() => ({ rows: [] as { email: string }[] }));

    await notifyReportRejected({
      tenantId: authContext.tenantId,
      ownerId: report.userId,
      ownerEmail: ownerEmailRow.rows[0]?.email ?? null,
      reportId,
      reportTitle: report.title,
      reason,
    });
    // ─────────────────────────────────────────────────────────────────────────

    return NextResponse.json(updatedReport, { status: 200 });
  } catch (error) {
    logger.error("Failed to reject report", {
      error: error instanceof Error ? error.message : String(error),
      reportId,
    });
    return NextResponse.json(
      { error: "Failed to reject report" },
      { status: 500 },
    );
  }
}

