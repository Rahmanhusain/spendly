import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { getPendingApprovalsForUser } from "@/lib/repositories/approvalRepository";
import { getReportById } from "@/lib/repositories/reportRepository";
import { query } from "@/lib/db/client";
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
 * GET /api/approvals
 * Get pending approvals for managers/admins
 */
export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Get pending approvals request started", {
    requestId,
    route: "/api/approvals",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "manager", "admin");

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));

    const { approvals, total } = await getPendingApprovalsForUser(
      authContext!.tenantId,
      authContext!.userId,
      limit,
      offset,
    );

    // Enrich with report details
    const enriched = await Promise.all(
      approvals.map(async (approval) => {
        const report = await getReportById(
          authContext!.tenantId,
          approval.reportId,
        );

        let reportCreator: {
          id: string;
          name: string;
        } | null = null;

        if (report?.userId) {
          const creatorResult = await query<{
            id: string;
            name: string;
          }>(
            `SELECT
              u.id::text as id,
              COALESCE(NULLIF(CONCAT(u.first_name, ' ', u.last_name), ''), u.email) as name
             FROM users u
             WHERE u.id = $1 AND u.tenant_id = $2
             LIMIT 1`,
            [report.userId, authContext!.tenantId],
          );

          if (creatorResult.rows[0]) {
            reportCreator = creatorResult.rows[0];
          }
        }

        return {
          approval,
          report: report || null,
          reportCreator,
        };
      }),
    );

    logger.info("Pending approvals retrieved successfully", {
      requestId,
      count: approvals.length,
      total,
    });

    return NextResponse.json(
      {
        data: enriched,
        pagination: {
          limit,
          offset,
          total,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to get pending approvals", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to get pending approvals" },
      { status: 500 },
    );
  }
}
