import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * GET /api/compliance/gst-report/history
 * Fetch paginated GST export history with optional date filtering.
 * Query params: offset, limit, from (ISO date), to (ISO date)
 */
export async function GET(request: NextRequest) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("GST history fetch request started", {
    requestId,
    route: "/api/compliance/gst-report/history",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const offset = parseInt(
      request.nextUrl.searchParams.get("offset") || "0",
      10,
    );
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get("limit") || "5", 10),
      50,
    );
    const dateFrom = request.nextUrl.searchParams.get("from");
    const dateTo = request.nextUrl.searchParams.get("to");

    const validatedOffset = Math.max(0, offset);
    const validatedLimit = Math.max(1, limit);

    let whereClause = "WHERE ge.tenant_id = $1";
    const params: (string | number)[] = [authContext!.tenantId];

    if (dateFrom) {
      whereClause += ` AND ge.generated_at >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND ge.generated_at < $${params.length + 1}`;
      params.push(dateTo + " 23:59:59");
    }

    // Fetch history records + 1 extra to determine if there are more
    const historyQuery = `
      SELECT 
        ge.id,
        ge.period_start,
        ge.period_end,
        ge.total_amount,
        ge.total_cgst,
        ge.total_sgst,
        ge.total_igst,
        ge.file_path,
        ge.generated_at,
        COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS generated_by_name,
        u.role AS generated_by_role
      FROM gst_exports ge
      LEFT JOIN users u ON ge.generated_by = u.id
      ${whereClause}
      ORDER BY ge.generated_at DESC
      LIMIT ${validatedLimit + 1} OFFSET ${validatedOffset}
    `;

    const result = await query(historyQuery, params);
    const records = result.rows as Array<{
      id: string;
      period_start: string;
      period_end: string;
      total_amount: string;
      total_cgst: string;
      total_sgst: string;
      total_igst: string;
      file_path: string | null;
      generated_at: string;
      generated_by_name: string;
      generated_by_role: string;
    }>;

    const hasMore = records.length > validatedLimit;
    const data = records.slice(0, validatedLimit);

    logger.info("GST history fetched successfully", {
      requestId,
      count: data.length,
      hasMore,
      offset: validatedOffset,
      limit: validatedLimit,
    });

    return NextResponse.json({
      ok: true,
      data,
      hasMore,
    });
  } catch (error) {
    logger.error("Failed to fetch GST history", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to fetch GST history" },
      { status: 500 },
    );
  }
}
