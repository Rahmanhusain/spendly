import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  getReportItemsWithDetails,
  getReportsForTenant,
} from "@/lib/repositories/reportRepository";
import {
  getUsersByTenant,
  getTenantById,
} from "@/lib/repositories/authRepository";
import { getReceiptsForTenant } from "@/lib/repositories/receiptRepository";
import { hasReportAccess } from "@/lib/repositories/reportAccessRepository";
import { ExpenseReportWorkspace } from "@/components/expense-report-workspace";
import ReportDetailLoading from "./loading";
import type { AuthContext } from "@/lib/middleware/auth";

export const metadata = buildPageMetadata({
  title: "Expense report details",
  description:
    "Review items, comments, approvals, and reimbursement status for a report.",
});

// ─── Data component — suspends while fetching ────────────────────────────────
async function ReportDetailData({
  authContext,
  reportId,
}: {
  authContext: AuthContext;
  reportId: string;
}) {
  // Fetch everything that doesn't depend on access check in parallel
  const [tenant, tenantUsers, report, reportsResult, receipts] =
    await Promise.all([
      getTenantById(authContext.tenantId),
      getUsersByTenant(authContext.tenantId),
      getReportById(authContext.tenantId, reportId),
      getReportsForTenant(authContext.tenantId, {
        userId:
          authContext.role === "employee" ? authContext.userId : undefined,
        status: "all",
        limit: 25,
        offset: 0,
      }),
      getReceiptsForTenant(authContext.tenantId, { limit: 999, offset: 0 }),
    ]);

  if (!report) {
    notFound();
  }

  // Access check + report items in parallel — both need report to exist
  const [canAccess, reportItems] = await Promise.all([
    hasReportAccess(
      authContext.tenantId,
      reportId,
      authContext.userId,
      authContext.role,
    ),
    getReportItemsWithDetails(authContext.tenantId, reportId),
  ]);

  if (!canAccess) {
    notFound();
  }

  const initialReports = reportsResult.reports.some((r) => r.id === report.id)
    ? reportsResult.reports
    : [report, ...reportsResult.reports];

  return (
    <ExpenseReportWorkspace
      initialReports={initialReports}
      initialReceiptsAvailable={receipts}
      initialHasMore={reportsResult.reports.length < reportsResult.total}
      initialSelectedReportId={report.id}
      initialSelectedDetails={{ report, items: reportItems }}
      authContext={authContext}
      orgName={tenant?.name ?? "Your workspace"}
      tenantUsers={tenantUsers}
      showReportBrowser={false}
    />
  );
}

// ─── Page — auth only, renders instantly ─────────────────────────────────────
export default async function ReportByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authContext = await getServerAuthContext();
  if (!authContext) {
    redirect("/api/auth/logout?next=/login");
  }

  const { id: reportId } = await params;

  return (
    <Suspense fallback={<ReportDetailLoading />}>
      <ReportDetailData authContext={authContext} reportId={reportId} />
    </Suspense>
  );
}
