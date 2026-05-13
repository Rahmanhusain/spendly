import { redirect } from "next/navigation";
import { getServerAuthContext, requireAuth } from "@/lib/middleware/auth";
import { getTenantById } from "@/lib/repositories/authRepository";
import {
  aggregateGstForPeriod,
  getGstExportHistoryForTenant,
} from "@/lib/repositories/gstRepository";
import { GstComplianceWorkspace } from "@/components/gst-compliance-workspace";

function getDefaultRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export default async function GstWorkspacePage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  requireAuth(authContext, "manager", "admin");

  const tenant = await getTenantById(authContext.tenantId);

  const { start, end } = getDefaultRange();
  const [initialSummary, initialHistory] = await Promise.all([
    aggregateGstForPeriod(authContext.tenantId, start, end),
    getGstExportHistoryForTenant(authContext.tenantId, 5),
  ]);

  const canExport =
    authContext.role === "manager" || authContext.role === "admin";

  return (
    <GstComplianceWorkspace
      key={initialHistory.map((entry) => entry.id).join("|")}
      orgName={tenant?.name ?? "Your workspace"}
      orgGstin={tenant?.gstin ?? process.env.GSTIN ?? null}
      orgAddress={
        tenant?.company_address ?? process.env.COMPANY_ADDRESS ?? null
      }
      canExport={canExport}
      initialStart={start}
      initialEnd={end}
      initialSummary={initialSummary}
      initialHistory={initialHistory}
    />
  );
}
