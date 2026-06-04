import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { requireActiveWorkspace } from "@/lib/middleware/requireActiveWorkspace";
import {
  createReport,
  getReportsForTenant,
  type ReportStatus,
} from "@/lib/repositories/reportRepository";
import { createAuditLog } from "@/lib/repositories/auditRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

function parseLimit(input: string | null): number {
  if (!input) return 25;
  const value = Number(input);
  if (!Number.isFinite(value)) return 25;
  return Math.min(Math.max(Math.floor(value), 1), 200);
}

function parseOffset(input: string | null): number {
  if (!input) return 0;
  const value = Number(input);
  if (!Number.isFinite(value)) return 0;
  return Math.max(Math.floor(value), 0);
}

/**
 * POST /api/reports
 * Create a new expense report
 */
export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Create report request started", {
    requestId,
    route: "/api/reports",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const guard = await requireActiveWorkspace(authContext!, requestId);
    if (guard) return guard;

    const body = await request.json();
    const { title, description, periodStart, periodEnd } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    // Basic validation for the story: ensure date range is consistent.
    if (periodStart && periodEnd) {
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return NextResponse.json(
          { error: "Invalid periodStart/periodEnd date format" },
          { status: 400 },
        );
      }
      if (end.getTime() < start.getTime()) {
        return NextResponse.json(
          { error: "periodEnd must be on or after periodStart" },
          { status: 400 },
        );
      }
    }

    const report = await createReport(
      authContext!.tenantId,
      authContext!.userId,
      {
        title: title.trim(),
        description: description?.trim() || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
      },
    );

    logger.info("Report created successfully", {
      requestId,
      reportId: report.id,
      userId: authContext!.userId,
    });

    // Audit trail for report creation.
    await createAuditLog(authContext!.tenantId, {
      userId: authContext!.userId,
      action: "report_created",
      resourceType: "expense_report",
      resourceId: report.id,
      details: {
        title: report.title,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
      },
    });

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    logger.error("Failed to create report", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to create report" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/reports
 * List reports for the current user or tenant
 */
export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("List reports request started", {
    requestId,
    route: "/api/reports",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));
    const status = url.searchParams.get("status") || "all";
    const search = url.searchParams.get("search") || undefined;
    const reportStatusOptions: ReportStatus[] = [
      "draft",
      "submitted",
      "info_requested",
      "approved",
      "rejected",
      "paid",
    ];
    const safeStatus: ReportStatus | "all" =
      status === "all"
        ? "all"
        : reportStatusOptions.includes(status as ReportStatus)
          ? (status as ReportStatus)
          : "all";

    // Employees see only their reports, managers/admins see all
    const userId =
      authContext!.role === "employee" ? authContext!.userId : undefined;

    const { reports, total } = await getReportsForTenant(
      authContext!.tenantId,
      {
        userId,
        status: safeStatus,
        search,
        limit,
        offset,
      },
    );

    logger.info("Reports retrieved successfully", {
      requestId,
      count: reports.length,
      total,
    });

    return NextResponse.json(
      {
        data: reports,
        pagination: {
          limit,
          offset,
          total,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to list reports", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to list reports" },
      { status: 500 },
    );
  }
}
