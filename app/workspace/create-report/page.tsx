import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById } from "@/lib/repositories/authRepository";
import { getReportsForTenant } from "@/lib/repositories/reportRepository";
import { getReceiptsForTenant } from "@/lib/repositories/receiptRepository";
import { ExpenseReportWorkspace } from "./expense-report-workspace";

export default async function CreateReportPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const pageSize = 25;

  const [reports, receipts, tenant] = await Promise.all([
    getReportsForTenant(authContext.tenantId, {
      userId: authContext.role === "employee" ? authContext.userId : undefined,
      limit: pageSize,
      offset: 0,
    }),
    getReceiptsForTenant(authContext.tenantId, {
      limit: 999,
      offset: 0,
    }),
    getTenantById(authContext.tenantId),
  ]);

  return (
    <ExpenseReportWorkspace
      initialReports={reports.reports}
      initialReceiptsAvailable={receipts}
      initialHasMore={reports.reports.length < reports.total}
      authContext={authContext}
      orgName={tenant?.name ?? "Your workspace"}
    />
  );
}
