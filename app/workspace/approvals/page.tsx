import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getUsersByTenant } from "@/lib/repositories/authRepository";
import { ApprovalsWorkspace } from "./approvals-workspace";
import ApprovalsLoading from "./loading";
import type { AuthContext } from "@/lib/middleware/auth";

// ─── Data component — suspends while fetching ────────────────────────────────
async function ApprovalsData({ authContext }: { authContext: AuthContext }) {
  const canApprove =
    authContext.role === "admin" || authContext.role === "manager";

  // tenantUsers is needed for the report activity panel inside ApprovalsWorkspace
  const tenantUsers = await getUsersByTenant(authContext.tenantId);

  return (
    <ApprovalsWorkspace
      canApprove={canApprove}
      authContext={{
        tenantId: authContext.tenantId,
        userId: authContext.userId,
        role: authContext.role,
      }}
      tenantUsers={tenantUsers}
    />
  );
}

// ─── Page — auth only, renders instantly ─────────────────────────────────────
export default async function ApprovalsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/api/auth/logout?next=/login");
  }

  return (
    <Suspense fallback={<ApprovalsLoading />}>
      <ApprovalsData authContext={authContext} />
    </Suspense>
  );
}
