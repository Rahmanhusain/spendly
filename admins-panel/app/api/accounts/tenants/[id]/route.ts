import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAdminAuthContext } from "../../../../../lib/middleware/adminAuth";
import {
  listUsersForTenant,
  setTenantStatus,
} from "../../../../../lib/repositories/adminRepository";
import { getTenantById } from "../../../../../lib/repositories/authRepository";

const statusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await extractAdminAuthContext(request);
  if (!ctx)
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );

  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const [tenant, users] = await Promise.all([
    getTenantById(id),
    listUsersForTenant(id, {
      search: searchParams.get("search") ?? undefined,
      limit: parseInt(searchParams.get("limit") ?? "50"),
      offset: parseInt(searchParams.get("offset") ?? "0"),
    }),
  ]);

  if (!tenant)
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND" } },
      { status: 404 },
    );

  return NextResponse.json({ ok: true, tenant, users }, { status: 200 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await extractAdminAuthContext(request);
  if (!ctx)
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );

  const { id } = await params;
  const body = await request.json();
  const { status } = statusSchema.parse(body);

  await setTenantStatus(id, status);
  return NextResponse.json({ ok: true }, { status: 200 });
}
