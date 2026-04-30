import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { getReportById } from "@/lib/repositories/reportRepository";
import {
  addReportAccess,
  removeReportAccess,
  getReportAccessList,
  hasReportAccess,
} from "@/lib/repositories/reportAccessRepository";
import { createAuditLog } from "@/lib/repositories/auditRepository";
import { sendNotification } from "@/lib/utils/notifications";
import { randomUUID } from "crypto";

/**
 * GET /api/reports/[id]/access
 * Get the access list for a report
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;

  try {
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (
      !(await hasReportAccess(
        authContext.tenantId,
        reportId,
        authContext.userId,
        authContext.role,
      ))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const accessList = await getReportAccessList(
      authContext.tenantId,
      reportId,
    );

    return NextResponse.json({
      ok: true,
      data: { accessList },
    });
  } catch (error) {
    console.error("Failed to fetch access list:", error);
    return NextResponse.json(
      { error: "Failed to fetch access list" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/reports/[id]/access
 * Add a user to report access list
 */
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;

  try {
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Only report creator, managers, and admins can add users to access list
    if (
      report.userId !== authContext.userId &&
      authContext.role !== "manager" &&
      authContext.role !== "admin"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 },
      );
    }

    if (userId === report.userId) {
      return NextResponse.json(
        { error: "Report creator already has access" },
        { status: 400 },
      );
    }

    const accessEntry = await addReportAccess(
      authContext.tenantId,
      reportId,
      userId,
      authContext.userId,
    );

    // Log audit event
    await createAuditLog(authContext.tenantId, {
      userId: authContext.userId,
      action: "report_access_granted",
      resourceType: "expense_report",
      resourceId: reportId,
      details: {
        grantedToUserId: userId,
      },
    });

    await sendNotification({
      tenantId: authContext.tenantId,
      userId,
      channel: "in_app",
      title: `You were added to "${report.title}"`,
      message: `You can now view comments and be mentioned in this expense report.`,
      relatedType: "expense_report",
      relatedId: reportId,
    });

    return NextResponse.json({
      ok: true,
      data: { accessEntry },
    });
  } catch (error) {
    console.error("Failed to add access:", error);
    return NextResponse.json(
      { error: "Failed to add access" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/reports/[id]/access
 * Remove a user from report access list
 */
async function handleDelete(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Only report creator, managers, and admins can remove users from access list
    if (
      report.userId !== authContext.userId &&
      authContext.role !== "manager" &&
      authContext.role !== "admin"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const removed = await removeReportAccess(
      authContext.tenantId,
      reportId,
      userId,
    );

    if (!removed) {
      return NextResponse.json(
        { error: "Access entry not found" },
        { status: 404 },
      );
    }

    // Log audit event
    await createAuditLog(authContext.tenantId, {
      userId: authContext.userId,
      action: "report_access_revoked",
      resourceType: "expense_report",
      resourceId: reportId,
      details: {
        revokedFromUserId: userId,
      },
    });

    return NextResponse.json({
      ok: true,
      data: { removed: true },
    });
  } catch (error) {
    console.error("Failed to remove access:", error);
    return NextResponse.json(
      { error: "Failed to remove access" },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleGet(req, { params });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handlePost(req, { params });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleDelete(req, { params });
}
