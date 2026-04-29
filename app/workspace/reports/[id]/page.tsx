import { notFound, redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import {
  getReportById,
  getReportItemsWithDetails,
  type ExpenseReport,
} from "@/lib/repositories/reportRepository";
import { getUsersByTenant } from "@/lib/repositories/authRepository";
import { query } from "@/lib/db/client";
import {
  ReportWorkspaceClient,
} from "./report-workspace-client";

export default async function ReportByIdPage({
  params,
}: {
  params: { id: string };
}) {
  const authContext = await getServerAuthContext();
  if (!authContext) {
    redirect("/login");
  }

  const reportId = params.id;

  const [report, tenantUsers] = await Promise.all([
    getReportById(authContext.tenantId, reportId),
    getUsersByTenant(authContext.tenantId),
  ]);

  if (!report) {
    notFound();
  }

  // Collaboration rules: employees can open reports they own, comment on, or are mentioned about.
  // For MVP we use the existence of an in-app notification targeting this report as the "mention/involvement" signal.
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

  const items = await getReportItemsWithDetails(authContext.tenantId, reportId);

  return (
    <ReportWorkspaceClient
      initialReport={report as ExpenseReport}
      reportItemsCount={items.length}
      authContext={authContext}
      tenantUsers={tenantUsers}
    />
  );
}

