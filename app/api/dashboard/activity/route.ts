import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { loadDashboardActivity } from "@/lib/repositories/dashboardRepository";

export async function GET(request: Request) {
  const auth = await getServerAuthContext();

  if (!auth) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "10");
  const activity = await loadDashboardActivity({
    tenantId: auth.tenantId,
    userId: auth.userId,
    role: auth.role,
    limit: Number.isNaN(limit) ? 10 : limit,
  });

  return NextResponse.json({ ok: true, data: activity });
}
