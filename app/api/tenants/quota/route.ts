import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { requireActiveWorkspace } from "@/lib/middleware/requireActiveWorkspace";
import { query } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  const authContext = await extractAuthContext(request, requestId);
  requireAuth(authContext);

  const guard = await requireActiveWorkspace(authContext!, requestId);
  if (guard) return guard;

  const quotaResult = await query<{
    receipt_quota_monthly: string;
    used_count: string;
  }>(
    `SELECT t.receipt_quota_monthly::text AS receipt_quota_monthly,
            (CASE WHEN t.monthly_upload_period_start = date_trunc('month', NOW())::date
                  THEN COALESCE(t.monthly_upload_count, 0)
                  ELSE 0 END)::text AS used_count
       FROM tenants t
      WHERE t.id = $1
      GROUP BY t.receipt_quota_monthly, t.monthly_upload_period_start, t.monthly_upload_count`,
    [authContext!.tenantId],
  );

  if (quotaResult.rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "TENANT_NOT_FOUND",
          message: "Workspace quota information is unavailable.",
          requestId,
        },
      },
      { status: 404 },
    );
  }

  const quotaMonthly = Number(quotaResult.rows[0].receipt_quota_monthly ?? "0");
  const quotaUsed = Number(quotaResult.rows[0].used_count ?? "0");
  const receiptQuotaRemaining = Math.max(0, quotaMonthly - quotaUsed);

  return NextResponse.json({
    ok: true,
    data: {
      receiptQuotaMonthly: quotaMonthly,
      receiptQuotaUsed: quotaUsed,
      receiptQuotaRemaining,
      quotaExceeded: receiptQuotaRemaining <= 0,
    },
  });
}
