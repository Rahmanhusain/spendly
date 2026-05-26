import { NextResponse } from "next/server";
import { extractAdminAuthContext } from "../../../../../lib/middleware/adminAuth";
import { markEmailRead } from "../../../../../lib/repositories/adminRepository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await extractAdminAuthContext(request);
  if (!ctx) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const { id } = await params;
  await markEmailRead(id, ctx.adminId);
  return NextResponse.json({ ok: true }, { status: 200 });
}
