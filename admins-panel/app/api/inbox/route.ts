import { NextResponse } from "next/server";
import { extractAdminAuthContext } from "../../../lib/middleware/adminAuth";
import { listInboundEmails } from "../../../lib/repositories/adminRepository";

export async function GET(request: Request) {
  const ctx = await extractAdminAuthContext(request);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const isReadParam = searchParams.get("isRead");

  const result = await listInboundEmails({
    isRead: isReadParam === null ? undefined : isReadParam === "true",
    search: searchParams.get("search") ?? undefined,
    limit: parseInt(searchParams.get("limit") ?? "20"),
    offset: parseInt(searchParams.get("offset") ?? "0"),
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
