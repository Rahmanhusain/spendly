import { NextResponse } from "next/server";
import { extractAdminAuthContext } from "../../../../lib/middleware/adminAuth";
import { listTenants } from "../../../../lib/repositories/adminRepository";

export async function GET(request: Request) {
  const ctx = await extractAdminAuthContext(request);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const result = await listTenants({
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: parseInt(searchParams.get("limit") ?? "20"),
    offset: parseInt(searchParams.get("offset") ?? "0"),
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
