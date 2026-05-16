import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  markReportAsPaid,
} from "@/lib/repositories/reportRepository";
import {
  createOrUpdateReimbursement,
  getReimbursement,
} from "@/lib/repositories/reimbursementRepository";
import {
  createAuditLog,
  logReportStatusChange,
} from "@/lib/repositories/auditRepository";
import { hasReportAccess } from "@/lib/repositories/reportAccessRepository";
import { sendNotification } from "@/lib/utils/notifications";
import { randomUUID } from "crypto";

/**
 * POST /api/reports/[id]/mark-paid
 * Mark a report as paid with reimbursement details
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authContext = await extractAuthContext(req, randomUUID());
  if (!authContext) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only managers/admins can mark reports as paid
  if (!["manager", "admin"].includes(authContext.role)) {
    return NextResponse.json(
      { error: "Only managers and admins can mark reports as paid" },
      { status: 403 },
    );
  }

  const { id: reportId } = await params;

  try {
    const body = await req.json();
    const { method, referenceNumber, amountPaid } = body;

    if (!method || !["upi", "bank", "cash", "other"].includes(method)) {
      return NextResponse.json(
        { error: "Valid payment method is required (upi, bank, cash, other)" },
        { status: 400 },
      );
    }

    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (report.status !== "approved") {
      return NextResponse.json(
        { error: "Report must be approved before marking as paid" },
        { status: 400 },
      );
    }

    // Mark report as paid
    const updatedReport = await markReportAsPaid(
      authContext.tenantId,
      reportId,
    );

    // Create or update reimbursement record
    const reimbursement = await createOrUpdateReimbursement(
      authContext.tenantId,
      reportId,
      {
        method,
        referenceNumber: referenceNumber || undefined,
        amountPaid: amountPaid || report.totalAmount,
        paidBy: authContext.userId,
      },
    );

    // Log status change
    await logReportStatusChange(
      authContext.tenantId,
      reportId,
      authContext.userId,
      "approved",
      "paid",
      {
        paymentMethod: method,
        referenceNumber: referenceNumber || null,
        amountPaid: amountPaid || report.totalAmount,
      },
    );

    // Log reimbursement creation
    await createAuditLog(authContext.tenantId, {
      userId: authContext.userId,
      action: "reimbursement_processed",
      resourceType: "expense_report",
      resourceId: reportId,
      details: {
        method,
        referenceNumber,
        amountPaid: amountPaid || report.totalAmount,
        reimbursementId: reimbursement.id,
      },
    });

    // Notify employee
    await sendNotification({
      tenantId: authContext.tenantId,
      userId: report.userId,
      channel: "in_app",
      title: `Your expense report "${report.title}" has been paid`,
      message: `Reimbursement of ₹${report.totalAmount} via ${method.toUpperCase()} has been processed.`,
      relatedType: "expense_report",
      relatedId: reportId,
    });

    return NextResponse.json({
      ok: true,
      data: {
        report: updatedReport,
        reimbursement,
      },
    });
  } catch (error) {
    console.error("Failed to mark report as paid:", error);
    return NextResponse.json(
      { error: "Failed to mark report as paid" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/reports/[id]/mark-paid
 * Get reimbursement details for a report.
 * Enforces the same access rules as the report itself.
 */
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
    const report = await getReportById(authContext.tenantId, reportId);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const canAccess = await hasReportAccess(
      authContext.tenantId,
      reportId,
      authContext.userId,
      authContext.role,
    );

    if (!canAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const reimbursement = await getReimbursement(
      authContext.tenantId,
      reportId,
    );

    return NextResponse.json({
      ok: true,
      data: {
        reimbursement,
      },
    });
  } catch (error) {
    console.error("Failed to fetch reimbursement details:", error);
    return NextResponse.json(
      { error: "Failed to fetch reimbursement details" },
      { status: 500 },
    );
  }
}
