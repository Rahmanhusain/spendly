import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { requireActiveWorkspace } from "@/lib/middleware/requireActiveWorkspace";
import { query } from "@/lib/db/client";
import { getTenantById } from "@/lib/repositories/authRepository";
import {
  aggregateGstForPeriod,
  createGstExportRecord,
} from "@/lib/repositories/gstRepository";
import renderer from "@/lib/services/gstExportRenderer";
import { storeGstExportFile } from "@/lib/storage/gst-export-storage";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

type ExportFormat = "html" | "csv" | "pdf";

function toCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvReport(input: {
  orgName: string;
  orgGstin: string;
  periodStart: string;
  periodEnd: string;
  data: Awaited<ReturnType<typeof aggregateGstForPeriod>>;
}) {
  const rows: (string | number | null | undefined)[][] = [
    ["GST Compliance Report"],
    ["Organization", input.orgName],
    ["GSTIN", input.orgGstin || "Not configured"],
    ["Period Start", input.periodStart],
    ["Period End", input.periodEnd],
    [],
    ["REPORT SUMMARY"],
    ["Metric", "Value"],
    ["Total Amount", input.data.totals.totalAmount],
    ["Total Tax", input.data.totals.totalTax],
    ["Effective Tax Rate %", input.data.totals.effectiveTaxRate.toFixed(2)],
    ["Number of Receipts", input.data.totals.receiptCount],
    [
      "Average per Receipt",
      input.data.totals.receiptCount > 0
        ? (input.data.totals.totalAmount / input.data.totals.receiptCount).toFixed(2)
        : 0,
    ],
    [],
    ["VENDOR DETAILS"],
    ["Category", "Vendor", "Vendor GSTIN", "Amount", "CGST", "SGST", "IGST", "Total Tax"],
    ...input.data.byVendor.map((row) => [
      row.category ?? "Uncategorized",
      row.vendor_name ?? "Unknown vendor",
      row.vendor_gstin ?? "",
      Number(row.total_amount || 0),
      Number(row.total_cgst || 0),
      Number(row.total_sgst || 0),
      Number(row.total_igst || 0),
      Number(row.total_tax || 0),
    ]),
    [],
    ["TOTALS"],
    ["Description", "Amount", "CGST", "SGST", "IGST", "Total Tax", "Receipt Count"],
    [
      "Total",
      input.data.totals.totalAmount,
      input.data.totals.totalCgst,
      input.data.totals.totalSgst,
      input.data.totals.totalIgst,
      input.data.totals.totalTax,
      input.data.totals.receiptCount,
    ],
  ];

  return rows
    .map((row) => row.map((cell) => toCsvCell(cell)).join(","))
    .join("\n");
}

/**
 * POST /api/compliance/gst-report/export
 * Generates a compliance report (HTML or CSV), uploads it to R2,
 * records the export in the DB, and streams the file to the client.
 * No local filesystem writes — fully compatible with Vercel/serverless.
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("GST report export request started", {
    requestId,
    route: "/api/compliance/gst-report/export",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const guard = await requireActiveWorkspace(authContext!, requestId);
    if (guard) return guard;

    if (authContext!.role === "employee") {
      const userResult = await query<{ can_export_gst: boolean }>(
        `SELECT can_export_gst FROM users WHERE id = $1`,
        [authContext!.userId],
      );
      if (!userResult.rows[0]?.can_export_gst) {
        return NextResponse.json(
          { error: "You do not have permission to export GST reports." },
          { status: 403 },
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as {
      start?: string;
      end?: string;
      format?: string;
    };

    const start = body.start ?? request.nextUrl.searchParams.get("start");
    const end = body.end ?? request.nextUrl.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing start or end parameter" },
        { status: 400 },
      );
    }

    const tenant = await getTenantById(authContext!.tenantId);
    const data = await aggregateGstForPeriod(authContext!.tenantId, start, end);

    if (data.totals.receiptCount === 0) {
      return NextResponse.json(
        {
          error:
            "Cannot export: No receipts found for the selected period. Please select a different date range.",
        },
        { status: 400 },
      );
    }

    const companyName = tenant?.name ?? process.env.COMPANY_NAME ?? "Company";
    const companyGstin = tenant?.gstin ?? process.env.GSTIN ?? "";

    const requestedFormat = (
      body.format ??
      request.nextUrl.searchParams.get("format") ??
      "pdf"
    ).toLowerCase() as ExportFormat;

    const format: ExportFormat =
      requestedFormat === "csv" || requestedFormat === "html" || requestedFormat === "pdf"
        ? requestedFormat
        : "pdf";

    // Build file content in memory
    let fileBuffer: Buffer;
    let contentType: string;
    let filename: string;

    if (format === "csv") {
      const csv = buildCsvReport({
        orgName: companyName,
        orgGstin: companyGstin,
        periodStart: start,
        periodEnd: end,
        data,
      });
      fileBuffer = Buffer.from(csv, "utf8");
      contentType = "text/csv; charset=utf-8";
      filename = `gst-report-${start}-${end}.csv`;
    } else {
      // html and pdf both render as HTML (PDF conversion requires Puppeteer)
      const html = renderer.renderGstHtml({
        companyName,
        companyGstin,
        periodStart: start,
        periodEnd: end,
        data,
        generatedAt: new Date().toISOString(),
      });
      fileBuffer = Buffer.from(html, "utf8");
      contentType = "text/html; charset=utf-8";
      filename = `gst-report-${start}-${end}.html`;
    }

    // Upload to R2 — replaces the local disk write
    const stored = await storeGstExportFile({
      tenantId: authContext!.tenantId,
      fileBuffer,
      filename,
      contentType,
    });

    // Record the export with the R2 storage path
    await createGstExportRecord({
      tenantId: authContext!.tenantId,
      generatedBy: authContext!.userId,
      periodStart: start,
      periodEnd: end,
      totalAmount: data.totals.totalAmount,
      totalCgst: data.totals.totalCgst,
      totalSgst: data.totals.totalSgst,
      totalIgst: data.totals.totalIgst,
      filePath: stored.storagePath,
    });

    logger.info("GST report exported and uploaded to R2", {
      requestId,
      format,
      storagePath: stored.storagePath,
      tenantId: authContext!.tenantId,
    });

    // Stream directly to the browser
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition":
          format === "csv"
            ? `attachment; filename="${filename}"`
            : `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error("Failed to export GST report", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to export GST report" },
      { status: 500 },
    );
  }
}
