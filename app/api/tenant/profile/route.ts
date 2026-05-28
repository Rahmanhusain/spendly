import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import { buildTenantWorkspaceUrl } from "@/lib/utils/tenant-host";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

const updateTenantProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    countryCode: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => /^[A-Z]{2}$/.test(value), {
        message: "Use a 2-letter country code",
      })
      .optional(),
    slug: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .refine((value) => value.length >= 2 && value.length <= 80, {
        message: "Workspace slug must be between 2 and 80 characters",
      })
      .refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
        message: "Use lowercase letters, numbers, and hyphens only",
      })
      .optional(),
  })
  .refine((value) => Boolean(value.name || value.countryCode || value.slug), {
    message: "No updatable fields provided.",
  });

export async function PATCH(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Update tenant profile request started", { requestId });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "admin");

    const parsedBody = updateTenantProfileSchema.safeParse(
      await request.json().catch(() => ({})),
    );

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            message:
              parsedBody.error.issues[0]?.message || "Invalid update payload.",
          },
        },
        { status: 400 },
      );
    }

    const body = parsedBody.data;

    const tenantResult = await query<{ slug: string }>(
      `SELECT slug FROM tenants WHERE id = $1`,
      [authContext!.tenantId],
    );

    if (tenantResult.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: { message: "Tenant not found." } },
        { status: 404 },
      );
    }

    const currentSlug = tenantResult.rows[0].slug;

    if (body.slug && body.slug !== currentSlug.toLowerCase()) {
      const slugCheck = await query<{ id: string }>(
        `SELECT id FROM tenants WHERE slug = $1 AND id <> $2 LIMIT 1`,
        [body.slug, authContext!.tenantId],
      );

      if (slugCheck.rows.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error: { message: "A workspace with this slug already exists." },
          },
          { status: 409 },
        );
      }
    }

    await query(
      `UPDATE tenants
       SET name = COALESCE($1, name),
           country_code = COALESCE($2, country_code),
           slug = COALESCE($3, slug),
           updated_at = NOW()
       WHERE id = $4`,
      [
        body.name ?? null,
        body.countryCode ?? null,
        body.slug ?? null,
        authContext!.tenantId,
      ],
    );

    const responseBody: {
      ok: true;
      message: string;
      workspaceUrl?: string;
    } = {
      ok: true,
      message: "Tenant updated.",
    };

    if (body.slug && body.slug !== currentSlug.toLowerCase()) {
      responseBody.workspaceUrl = buildTenantWorkspaceUrl(
        body.slug,
        request.url,
        process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN,
      );
    }

    logger.info("Tenant profile updated", {
      requestId,
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
    });

    return NextResponse.json(responseBody, { status: 200 });
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
