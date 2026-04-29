import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  getTenantById,
  getUsersByTenant,
} from "@/lib/repositories/authRepository";
import { getReportsForTenant } from "@/lib/repositories/reportRepository";
import { getReceiptsForTenant } from "@/lib/repositories/receiptRepository";
import { ReportsWorkspaceTabs } from "./reports-workspace-tabs";

export default async function ReportsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const canApprove =
    authContext.role === "manager" || authContext.role === "admin";

  const pageSize = 25;

  const [tenant, users, reportsResult, receipts] = await Promise.all([
    getTenantById(authContext.tenantId),
    getUsersByTenant(authContext.tenantId),
    getReportsForTenant(authContext.tenantId, {
      userId: authContext.role === "employee" ? authContext.userId : undefined,
      status: "all",
      limit: pageSize,
      offset: 0,
    }),
    getReceiptsForTenant(authContext.tenantId, {
      limit: 999,
      offset: 0,
    }),
  ]);

  return (
    <ReportsWorkspaceTabs
      initialReports={reportsResult.reports}
      initialReceiptsAvailable={receipts}
      initialHasMore={reportsResult.reports.length < reportsResult.total}
      authContext={authContext}
      orgName={tenant?.name ?? "Your workspace"}
      tenantUsers={users}
    />
  );
}

