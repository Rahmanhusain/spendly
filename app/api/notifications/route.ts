import crypto from "crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db/client";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

function parseLimit(input: string | null): number {
  if (!input) return 20;
  const value = Number(input);
  if (!Number.isFinite(value)) return 20;
  return Math.min(Math.max(Math.floor(value), 1), 100);
}

function parseOffset(input: string | null): number {
  if (!input) return 0;
  const value = Number(input);
  if (!Number.isFinite(value)) return 0;
  return Math.max(Math.floor(value), 0);
}

/**
 * GET /api/notifications
 */
export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));
    const unreadOnly = url.searchParams.get("unreadOnly") === "1";

    const where = unreadOnly
      ? "tenant_id = $1 AND user_id = $2 AND channel = 'in_app' AND is_read = FALSE"
      : "tenant_id = $1 AND user_id = $2 AND channel = 'in_app'";

    const [listResult, unreadResult] = await Promise.all([
      query<{
        id: string;
        title: string;
        message: string;
        isRead: boolean;
        relatedType: string | null;
        relatedId: string | null;
        createdAt: string;
      }>(
        `SELECT
          id::text as id,
          title,
          message,
          is_read as "isRead",
          related_type as "relatedType",
          related_id::text as "relatedId",
          created_at::text as "createdAt"
         FROM notifications
         WHERE ${where}
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [authContext!.tenantId, authContext!.userId, limit, offset],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count
         FROM notifications
         WHERE tenant_id = $1 AND user_id = $2 AND channel = 'in_app' AND is_read = FALSE`,
        [authContext!.tenantId, authContext!.userId],
      ),
    ]);

    return NextResponse.json(
      {
        ok: true,
        data: {
          notifications: listResult.rows,
          unreadCount: Number(unreadResult.rows[0]?.count || 0),
        },
        pagination: {
          limit,
          offset,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to get notifications", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to get notifications" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/notifications
 * Body: { action: "mark_all_read" }
 */
export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
    };

    if (body.action !== "mark_all_read") {
      return NextResponse.json(
        { ok: false, error: "Invalid action" },
        { status: 400 },
      );
    }

    await query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE tenant_id = $1 AND user_id = $2 AND channel = 'in_app' AND is_read = FALSE`,
      [authContext!.tenantId, authContext!.userId],
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error("Failed to update notifications", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}
