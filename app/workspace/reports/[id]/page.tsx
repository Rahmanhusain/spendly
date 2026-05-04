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
import { query } from "@/lib/db/client";
import { ExpenseReportWorkspace } from "@/components/expense-report-workspace";

export default async function ReportByIdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authContext = await getServerAuthContext();
  if (!authContext) {
    redirect("/login");
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

  if (authContext.role === "employee" && report.userId !== authContext.userId) {
    const mentionResult = await query<{ exists: boolean }>(
      `SELECT EXISTS(
        SELECT 1
        FROM notifications n
        WHERE n.tenant_id = $1
          AND n.user_id = $2
          AND n.channel = 'in_app'
          AND n.related_type = 'expense_report'
          AND n.related_id = $3
      ) as "exists"`,
      [authContext.tenantId, authContext.userId, reportId],
    );

    const exists = mentionResult.rows[0]?.exists ?? false;
    if (!exists) {
      notFound();
    }
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
