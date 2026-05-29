import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import { getGstExportFileContents } from "@/lib/storage/gst-export-storage";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

/**
 * GET /api/compliance/gst-report/view/[id]?format=html
 *
 * Returns the stored HTML export so the browser renders the exact report
 * captured at export time.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const { id } = await params;
    const format = (
      request.nextUrl.searchParams.get("format") ?? "html"
    ).toLowerCase();

    if (format !== "html") {
      return NextResponse.json(
        { error: "Only HTML view is supported for stored GST exports." },
        { status: 400 },
      );
    }

    // Look up the export record
    const result = await query<{
      id: string;
      tenant_id: string;
      file_path: string | null;
    }>(
      `SELECT id, tenant_id, file_path
       FROM gst_exports
       WHERE id = $1 AND tenant_id = $2`,
      [id, authContext!.tenantId],
    );

    const record = result.rows[0];
    if (!record) {
      return NextResponse.json(
        { error: "Export record not found." },
        { status: 404 },
      );
    }

    const fileContents = await getGstExportFileContents(record.file_path);

    if (!fileContents) {
      logger.error("Stored GST export file is unavailable", {
        requestId,
        exportId: record.id,
        tenantId: record.tenant_id,
        filePath: record.file_path,
      });

      return NextResponse.json(
        { error: "Stored export file is unavailable." },
        { status: 404 },
      );
    }

    return new NextResponse(fileContents, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="gst-report-${id}.html"`,
      },
    });
  } catch (error) {
    logger.error("Failed to view GST export", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to load report." },
      { status: 500 },
    );
  }
}
