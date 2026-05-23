import { Suspense } from "react";
import { redirect } from "next/navigation";
import { buildPageMetadata } from "@/lib/seo";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { redirectToLogin } from "@/lib/auth/redirect";
import {
  aggregateGstForPeriod,
  getGstExportHistoryForTenant,
} from "@/lib/repositories/gstRepository";
import { GstComplianceWorkspace } from "@/components/gst-compliance-workspace";
import GstLoading from "./loading";
import type { AuthContext } from "@/lib/middleware/auth";

export const metadata = buildPageMetadata({
  title: "GST reports",
  description:
    "Review GST-ready exports, compliance summaries, and tax totals for your workspace.",
});

function getDefaultRange() {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

// ─── Data component — suspends while fetching ────────────────────────────────
async function GstData({
  authContext,
  isManagerOrAdmin,
}: {
  authContext: AuthContext;
  isManagerOrAdmin: boolean;
}) {
  const { start, end } = getDefaultRange();

  const [tenant, initialSummary, initialHistory] = await Promise.all([
    getTenantById(authContext.tenantId),
    aggregateGstForPeriod(authContext.tenantId, start, end),
    getGstExportHistoryForTenant(authContext.tenantId, 5),
  ]);

  return (
    <GstComplianceWorkspace
      key={initialHistory.map((entry) => entry.id).join("|")}
      orgName={tenant?.name ?? "Your workspace"}
      orgGstin={tenant?.gstin ?? process.env.GSTIN ?? null}
      orgAddress={
        tenant?.company_address ?? process.env.COMPANY_ADDRESS ?? null
      }
      canExport={isManagerOrAdmin}
      initialStart={start}
      initialEnd={end}
      initialSummary={initialSummary}
      initialHistory={initialHistory}
    />
  );
}

// ─── Page — auth + permission check only, renders instantly ──────────────────
export default async function GstWorkspacePage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirectToLogin();
  }

  const isManagerOrAdmin =
    authContext.role === "manager" || authContext.role === "admin";

  // Employees need the can_export_gst flag — check the DB before showing page
  if (!isManagerOrAdmin) {
    const user = await getUserById(authContext.userId);
    if (!user?.can_export_gst) {
      redirect("/workspace");
    }
  }

  return (
    <Suspense fallback={<GstLoading />}>
      <GstData authContext={authContext} isManagerOrAdmin={isManagerOrAdmin} />
    </Suspense>
  );
}
