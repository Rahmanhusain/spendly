import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/login");
  }

  const [user, tenant] = await Promise.all([
    getUserById(authContext.userId),
    getTenantById(authContext.tenantId),
  ]);

  const displayName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
    : "Workspace user";

  const roleLabel =
    authContext.role.charAt(0).toUpperCase() + authContext.role.slice(1);

  return (
    <WorkspaceShell
      orgName={tenant?.name ?? "Your workspace"}
      tenantId={authContext.tenantId}
      roleLabel={roleLabel}
      canSendInvites={
        authContext.role === "admin" || authContext.role === "manager"
      }
      userLabel={displayName || "Workspace user"}
    >
      {children}
    </WorkspaceShell>
  );
}
