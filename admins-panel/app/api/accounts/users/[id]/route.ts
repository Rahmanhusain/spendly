import { NextResponse } from "next/server";
import { z } from "zod";
import { extractAdminAuthContext } from "../../../../../lib/middleware/adminAuth";
import {
  setUserStatus,
  resetUserPassword,
} from "../../../../../lib/repositories/adminRepository";

const statusSchema = z.object({
  action: z.literal("set_status"),
  status: z.enum(["active", "inactive", "suspended"]),
});

const passwordSchema = z.object({
  action: z.literal("reset_password"),
  new_password: z.string().min(8, "Password must be at least 8 characters."),
});

const bodySchema = z.discriminatedUnion("action", [
  statusSchema,
  passwordSchema,
]);

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
  const parsed = bodySchema.parse(body);

  if (parsed.action === "set_status") {
    await setUserStatus(id, parsed.status);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (parsed.action === "reset_password") {
    await resetUserPassword(id, parsed.new_password);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  return NextResponse.json(
    { ok: false, error: { code: "BAD_REQUEST" } },
    { status: 400 },
  );
}
