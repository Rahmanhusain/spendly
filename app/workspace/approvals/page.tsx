import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { ApprovalsWorkspace } from "./approvals-workspace";
import { getUsersByTenant } from "@/lib/repositories/authRepository";

export default async function ApprovalsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/api/auth/logout?next=/login");
  }

  const canApprove =
    authContext.role === "admin" || authContext.role === "manager";

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
