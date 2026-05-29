import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import {
  aggregateGstForPeriod,
  createGstExportRecord,
} from "@/lib/repositories/gstRepository";
import renderer from "@/lib/services/gstExportRenderer";
import { storeGstExportFile } from "@/lib/storage/gst-export-storage";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * GET /api/compliance/gst-report?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Returns aggregated GST data for the tenant.
 */
export async function GET(request: NextRequest) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("GST report aggregation request started", {
    requestId,
    route: "/api/compliance/gst-report",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    if (authContext!.role === "employee") {
      const userResult = await query<{ can_export_gst: boolean }>(
        `SELECT can_export_gst FROM users WHERE id = $1`,
        [authContext!.userId],
      );
      if (!userResult.rows[0]?.can_export_gst) {
        return NextResponse.json(
          { error: "You do not have permission to access GST reports." },
          { status: 403 },
        );
      }
    }

    const start = request.nextUrl.searchParams.get("start");
    const end = request.nextUrl.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing start or end parameter" },
        { status: 400 },
      );
    }

    const data = await aggregateGstForPeriod(authContext!.tenantId, start, end);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    logger.error("Failed to aggregate GST report", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to aggregate GST report" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/compliance/gst-report
 * Generates an HTML report, uploads it to R2, records the export,
 * and streams the file directly to the client.
 */
export async function POST(request: NextRequest) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("GST report export request started", {
    requestId,
    route: "/api/compliance/gst-report",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

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
    };
    const start = body.start ?? request.nextUrl.searchParams.get("start");
    const end = body.end ?? request.nextUrl.searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "Missing start or end parameter" },
        { status: 400 },
      );
    }

    const data = await aggregateGstForPeriod(authContext!.tenantId, start, end);

    const companyName = process.env.COMPANY_NAME || "Company";
    const companyGstin = process.env.GSTIN || "";

    const html = renderer.renderGstHtml({
      companyName,
      companyGstin,
      periodStart: start,
      periodEnd: end,
      data,
      generatedAt: new Date().toISOString(),
    });

    const filename = `gst-report-${start}-${end}.html`;
    const fileBuffer = Buffer.from(html, "utf8");

    // Upload to R2 — no local disk write
    const stored = await storeGstExportFile({
      tenantId: authContext!.tenantId,
      fileBuffer,
      filename,
      contentType: "text/html; charset=utf-8",
    });

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
      storagePath: stored.storagePath,
    });

    // Stream the file directly to the browser
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
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
