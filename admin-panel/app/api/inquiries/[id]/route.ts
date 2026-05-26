import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAdminAuthContext } from "../../../../lib/middleware/adminAuth";
import {
  getInquiryById,
  updateInquiryStatus,
} from "../../../../lib/repositories/adminRepository";

const updateSchema = z.object({
  status: z.enum(["new", "in_review", "reviewed", "closed"]),
  admin_notes: z.string().max(2000).optional(),
});

export async function GET(
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
  const inquiry = await getInquiryById(id);
  if (!inquiry) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, inquiry }, { status: 200 });
}

export async function PATCH(
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
  const body = await request.json();
  const { status, admin_notes } = updateSchema.parse(body);

  const updated = await updateInquiryStatus(
    id,
    status,
    ctx.adminId,
    admin_notes,
  );
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, inquiry: updated }, { status: 200 });
}
