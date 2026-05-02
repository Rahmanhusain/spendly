import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  resubmitReport,
} from "@/lib/repositories/reportRepository";
import { logReportStatusChange } from "@/lib/repositories/auditRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * POST /api/reports/[id]/resubmit
 * Transitions a rejected report back to draft so the employee can edit and
 * re-submit for approval.
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

  const { id: reportId } = await params;

  try {
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Only the report owner (or admin) can resubmit.
    if (
      authContext.role === "employee" &&
      report.userId !== authContext.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (report.status !== "rejected") {
      return NextResponse.json(
        { error: "Only rejected reports can be resubmitted" },
        { status: 400 },
      );
    }

    const updatedReport = await resubmitReport(authContext.tenantId, reportId);

    await logReportStatusChange(
      authContext.tenantId,
      reportId,
      authContext.userId,
      "rejected",
      "draft",
      { action: "resubmit" },
    );

    return NextResponse.json(updatedReport, { status: 200 });
  } catch (error) {
    logger.error("Failed to resubmit report", {
      error: error instanceof Error ? error.message : String(error),
      reportId,
    });
    return NextResponse.json(
      { error: "Failed to resubmit report" },
      { status: 500 },
    );
  }
}
