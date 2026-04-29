import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  requestInfoReport,
} from "@/lib/repositories/reportRepository";
import { logReportStatusChange } from "@/lib/repositories/auditRepository";
import { sendNotification } from "@/lib/utils/notifications";
import {
  getApprovalWorkflow,
  requestInfoOnApproval,
} from "@/lib/repositories/approvalRepository";
import { randomUUID } from "crypto";

/**
 * POST /api/reports/[id]/request-info
 * Request additional information from employee (change status to info_requested)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only managers/admins can request info
  if (!["manager", "admin"].includes(authContext.role)) {
    return NextResponse.json(
      { error: "Only managers and admins can request information" },
      { status: 403 },
    );
  }

  const { id: reportId } = await params;

  try {
    const body = await req.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Request reason is required" },
        { status: 400 },
      );
    }

    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "submitted") {
      return NextResponse.json(
        { error: "Can only request info on submitted reports" },
        { status: 400 },
      );
    }

    // Keep queue state consistent: update the approval_workflows row too.
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

    await requestInfoOnApproval(
      authContext.tenantId,
      workflow.id,
      authContext.userId,
      reason,
    );

    // Update status to info_requested
    const updatedReport = await requestInfoReport(
      authContext.tenantId,
      reportId,
      reason,
    );

    // Log status change
    await logReportStatusChange(
      authContext.tenantId,
      reportId,
      authContext.userId,
      "submitted",
      "info_requested",
      { reason },
    );

    // Notify employee that more info is needed
    await sendNotification({
      tenantId: authContext.tenantId,
      userId: report.userId,
      channel: "in_app",
      title: `Additional information requested for "${report.title}"`,
      message: reason.substring(0, 100),
      relatedType: "expense_report",
      relatedId: reportId,
    });

    return NextResponse.json({
      ok: true,
      data: { report: updatedReport },
    });
  } catch (error) {
    console.error("Failed to request info:", error);
    return NextResponse.json(
      { error: "Failed to request additional information" },
      { status: 500 },
    );
  }
}
