import { Suspense } from "react";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { redirectToLogin } from "@/lib/auth/redirect";
import {
  getTenantById,
  getUsersByTenant,
} from "@/lib/repositories/authRepository";
import { getReportsForTenant } from "@/lib/repositories/reportRepository";
import { getReceiptsForTenant } from "@/lib/repositories/receiptRepository";
import { ReportsWorkspaceTabs } from "./reports-workspace-tabs";
import ReportsLoading from "./loading";
import type { AuthContext } from "@/lib/middleware/auth";

export const metadata = buildPageMetadata({
  title: "Expense reports",
  description:
    "Track drafts, submissions, and approvals across workspace expense reports.",
});

// ─── Data component — suspends while fetching ────────────────────────────────
async function ReportsData({ authContext }: { authContext: AuthContext }) {
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
    getReceiptsForTenant(authContext.tenantId, { limit: 999, offset: 0 }),
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

// ─── Page — auth only, renders instantly ─────────────────────────────────────
export default async function ReportsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirectToLogin();
  }

  return (
    <Suspense fallback={<ReportsLoading />}>
      <ReportsData authContext={authContext} />
    </Suspense>
  );
}
