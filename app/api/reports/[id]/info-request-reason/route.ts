import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import { getApprovalWorkflow } from "@/lib/repositories/approvalRepository";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;

  try {
    const workflow = await getApprovalWorkflow(authContext.tenantId, reportId);
    if (!workflow) {
      return NextResponse.json(
        { ok: false, error: "Not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: { reason: workflow.comments } });
  } catch (error) {
    console.error("Error fetching info request reason:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
