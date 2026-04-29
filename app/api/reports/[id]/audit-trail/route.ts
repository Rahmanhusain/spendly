import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import { getReportById } from "@/lib/repositories/reportRepository";
import {
  getReportAuditLog,
  getReportActivitySummary,
} from "@/lib/repositories/auditRepository";
import { randomUUID } from "crypto";

/**
 * GET /api/reports/[id]/audit-trail
 * Get audit log and activity summary for a report
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;

  try {
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const [auditLog, activity] = await Promise.all([
      getReportAuditLog(authContext.tenantId, reportId),
      getReportActivitySummary(authContext.tenantId, reportId),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        auditLog,
        activity,
      },
    });
  } catch (error) {
    console.error("Failed to fetch audit trail:", error);
    return NextResponse.json(
      { error: "Failed to fetch audit trail" },
      { status: 500 },
    );
  }
}
