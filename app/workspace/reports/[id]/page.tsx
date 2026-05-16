import { notFound, redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  getReportItemsWithDetails,
  getReportsForTenant,
  type ExpenseReport,
} from "@/lib/repositories/reportRepository";
import {
  getUsersByTenant,
  getTenantById,
} from "@/lib/repositories/authRepository";
import { getReceiptsForTenant } from "@/lib/repositories/receiptRepository";
import { hasReportAccess } from "@/lib/repositories/reportAccessRepository";
import { ExpenseReportWorkspace } from "@/components/expense-report-workspace";

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
      getReceiptsForTenant(authContext.tenantId, {
        limit: 999,
        offset: 0,
      }),
    ]);

  if (!report) {
    notFound();
  }

  // Enforce access control: employees can only view reports they own or
  // have been explicitly granted access to via report_access_list.
  // Managers and admins can see all reports (hasReportAccess handles this).
  const canAccess = await hasReportAccess(
    authContext.tenantId,
    reportId,
    authContext.userId,
    authContext.role,
  );

  if (!canAccess) {
    notFound();
  }

  const reportItems = await getReportItemsWithDetails(
    authContext.tenantId,
    reportId,
  );

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
