import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getReportById,
  getReportItemsWithDetails,
} from "@/lib/repositories/reportRepository";
import { hasReportAccess } from "@/lib/repositories/reportAccessRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * Helper function to get date range from receipts
 */
async function getDateRangeFromReceipts(
  reportItems: any[],
): Promise<{ periodStart?: string; periodEnd?: string }> {
  if (reportItems.length === 0) {
    return {};
  }

  const dates = reportItems
    .map((item) => item.receiptDate || item.receipt_date)
    .filter(Boolean)
    .map((value) => new Date(value as string))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (dates.length === 0) {
    return {};
  }

  // Get min and max dates
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  return {
    periodStart: minDate.toISOString().split("T")[0],
    periodEnd: maxDate.toISOString().split("T")[0],
  };
}

/**
 * GET /api/reports/[id]/export?format=csv|json
 * Export a report in CSV or JSON format
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;
  const reportId = (await params).id;
  const format = request.nextUrl.searchParams.get("format") || "json";

  logger.info("Export report request started", {
    requestId,
    reportId,
    format,
    route: "/api/reports/[id]/export",
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

    // Get date range from receipts if not already set
    const dateRange = await getDateRangeFromReceipts(items);
    const periodStart = report.periodStart || dateRange.periodStart;
    const periodEnd = report.periodEnd || dateRange.periodEnd;

    // Prepare report data
    const reportData = {
      ...report,
      periodStart,
      periodEnd,
      items,
    };

    if (format === "csv") {
      // Generate CSV
      const csvContent = generateCSV(reportData);
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="report-${reportId}.csv"`,
        },
      });
    } else {
      // Default to JSON
      return NextResponse.json(
        {
          ok: true,
          data: reportData,
        },
        { status: 200 },
      );
    }
  } catch (error) {
    logger.error("Failed to export report", {
      requestId,
      reportId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 },
    );
  }
}

/**
 * Helper function to generate CSV from report data
 */
function generateCSV(report: any): string {
  const headers = [
    "Receipt ID",
    "Date",
    "Vendor",
    "Amount",
    "Category",
    "GST Amount",
    "Status",
  ];

  const rows = report.items.map((item: any) => [
    item.receipt_id || "",
    item.receipt_date || "",
    item.vendor || "",
    item.amount || 0,
    item.category || "",
    item.tax_amount || 0,
    item.receipt_status || "",
  ]);

  // Add summary rows
  rows.push([]);
  rows.push(["SUMMARY", "", "", "", "", "", ""]);
  rows.push(["Report Title:", report.title, "", "", "", "", ""]);
  rows.push(["Period Start:", report.periodStart || "", "", "", "", "", ""]);
  rows.push(["Period End:", report.periodEnd || "", "", "", "", "", ""]);
  rows.push(["Total Amount:", report.totalAmount || 0, "", "", "", "", ""]);
  rows.push(["Status:", report.status, "", "", "", "", ""]);

  // Format CSV
  const csvLines = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row: any[]) =>
      row
        .map((cell) => {
          const value = String(cell || "");
          // Escape quotes and wrap in quotes if contains comma or quote
          if (value.includes(",") || value.includes('"')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return `"${value}"`;
        })
        .join(","),
    ),
  ];

  return csvLines.join("\n");
}
