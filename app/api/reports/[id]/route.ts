import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getReportById,
  updateReport,
  getReportItemsWithDetails,
  submitReport,
  deleteReport,
} from "@/lib/repositories/reportRepository";
import { hasReportAccess } from "@/lib/repositories/reportAccessRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * GET /api/reports/[id]
 * Get a specific report with its items
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const reportId = (await params).id;

  logger.info("Get report request started", {
    requestId,
    reportId,
    route: "/api/reports/[id]",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const report = await getReportById(authContext!.tenantId, reportId);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check authorization with access control
    const hasAccess = await hasReportAccess(
      authContext!.tenantId,
      reportId,
      authContext!.userId,
      authContext!.role,
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const items = await getReportItemsWithDetails(
      authContext!.tenantId,
      reportId,
    );

    logger.info("Report retrieved successfully", {
      requestId,
      reportId,
      itemCount: items.length,
    });

    return NextResponse.json(
      {
        report,
        items,
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to get report", {
      requestId,
      reportId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to get report" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/reports/[id]
 * Update a report (draft only)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const reportId = (await params).id;

  logger.info("Update report request started", {
    requestId,
    reportId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const report = await getReportById(authContext!.tenantId, reportId);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Authorization: only owner or admin can update
    if (
      authContext!.role === "employee" &&
      report.userId !== authContext!.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Can only update draft reports
    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Can only update draft reports" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const updated = await updateReport(authContext!.tenantId, reportId, body);

    logger.info("Report updated successfully", {
      requestId,
      reportId,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    logger.error("Failed to update report", {
      requestId,
      reportId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to update report" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/reports/[id]
 * Delete a report (draft only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const reportId = (await params).id;

  logger.info("Delete report request started", {
    requestId,
    reportId,
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const report = await getReportById(authContext!.tenantId, reportId);

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Authorization
    if (
      authContext!.role === "employee" &&
      report.userId !== authContext!.userId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Can only delete draft reports
    if (report.status !== "draft") {
      return NextResponse.json(
        { error: "Can only delete draft reports" },
        { status: 400 },
      );
    }

    await deleteReport(authContext!.tenantId, reportId);

    logger.info("Report deleted successfully", {
      requestId,
      reportId,
    });

    return NextResponse.json({ message: "Report deleted" }, { status: 200 });
  } catch (error) {
    logger.error("Failed to delete report", {
      requestId,
      reportId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 },
    );
  }
}
