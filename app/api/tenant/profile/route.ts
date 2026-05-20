import { NextResponse } from "next/server";
import crypto from "crypto";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Update tenant profile request started", { requestId });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin");

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      countryCode?: string;
    };

    if (!body.name && !body.countryCode) {
      return NextResponse.json(
        { ok: false, error: { message: "No updatable fields provided." } },
        { status: 400 },
      );
    }

    await query(
      `UPDATE tenants SET name = COALESCE($1, name), country_code = COALESCE($2, country_code), updated_at = NOW() WHERE id = $3`,
      [
        body.name ?? null,
        body.countryCode ? body.countryCode.toUpperCase() : null,
        authContext!.tenantId,
      ],
    );

    logger.info("Tenant profile updated", {
      requestId,
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
    });

    return NextResponse.json(
      { ok: true, message: "Tenant updated." },
      { status: 200 },
    );
  } catch (error) {
    logger.error("Failed to update tenant profile", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: { message: "Failed to update tenant." } },
      { status: 400 },
    );
  }
}
