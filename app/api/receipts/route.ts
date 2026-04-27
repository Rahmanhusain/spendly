import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  getReceiptCountForTenant,
  getReceiptsForTenant,
} from "@/lib/repositories/receiptRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

type ReceiptStatus =
  | "processing"
  | "draft"
  | "verified"
  | "needs_review"
  | "archived";

const RECEIPT_STATUSES = new Set<ReceiptStatus>([
  "processing",
  "draft",
  "verified",
  "needs_review",
  "archived",
]);

function parseLimit(input: string | null): number {
  if (!input) {
    return 25;
  }

  const value = Number(input);
  if (!Number.isFinite(value)) {
    return 25;
  }

  return Math.min(Math.max(Math.floor(value), 1), 200);
}

function parseOffset(input: string | null): number {
  if (!input) {
    return 0;
  }

  const value = Number(input);
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(Math.floor(value), 0);
}

function parseSearch(input: string | null): string | undefined {
  const value = input?.trim();

  return value ? value.slice(0, 120) : undefined;
}

function parseFilterValue(input: string | null): string | "all" {
  if (!input || input === "all") {
    return "all";
  }

  return input.trim();
}

function parseStatusValue(input: string | null): ReceiptStatus | "all" {
  if (!input || input === "all") {
    return "all";
  }

  const value = input.trim() as ReceiptStatus;
  return RECEIPT_STATUSES.has(value) ? value : "all";
}

function parseDate(input: string | null): string | undefined {
  if (!input) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return undefined;
  }

  return input;
}

function parseAll(input: string | null): boolean {
  if (!input) {
    return false;
  }

  return ["1", "true", "yes", "all"].includes(input.toLowerCase());
}

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Receipt list request started", {
    requestId,
    route: "/api/receipts",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const offset = parseOffset(url.searchParams.get("offset"));
    const search = parseSearch(url.searchParams.get("search"));
    const status = parseStatusValue(url.searchParams.get("status"));
    const category = parseFilterValue(url.searchParams.get("category"));
    const all = parseAll(url.searchParams.get("all"));
    const dateFrom = all
      ? undefined
      : parseDate(url.searchParams.get("dateFrom"));
    const dateTo = all ? undefined : parseDate(url.searchParams.get("dateTo"));

    const [receipts, total] = await Promise.all([
      getReceiptsForTenant(authContext!.tenantId, {
        limit,
        offset,
        search,
        status,
        category,
        dateFrom,
        dateTo,
      }),
      getReceiptCountForTenant(authContext!.tenantId, {
        search,
        status,
        category,
        dateFrom,
        dateTo,
      }),
    ]);

    const hasMore = offset + receipts.length < total;

    logger.info("Receipt list request completed", {
      requestId,
      route: "/api/receipts",
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
      all,
      dateFrom,
      dateTo,
      search,
      status,
      category,
      limit,
      offset,
      returned: receipts.length,
      total,
      hasMore,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        data: {
          receipts,
          pagination: {
            limit,
            offset,
            total,
            hasMore,
          },
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch receipts list.";

    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("Forbidden")
        ? 403
        : 400;

    logger.error("Receipt list request failed", {
      requestId,
      route: "/api/receipts",
      status,
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RECEIPT_LIST_FAILED",
          message,
          requestId,
        },
      },
      { status },
    );
  }
}
