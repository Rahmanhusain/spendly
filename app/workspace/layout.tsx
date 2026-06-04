import { WorkspaceShell } from "@/components/workspace-shell";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { buildPageMetadata } from "@/lib/seo";
import { PUBLIC_SITE_URL, redirectToLogout } from "@/lib/auth/redirect";
import { SubscriptionProvider } from "@/lib/context/SubscriptionContext";

export const metadata = buildPageMetadata({
  title: "Workspace",
  description:
    "Secure Spendly workspace for receipts, approvals, policies, reports, and compliance tools.",
  noIndex: true,
});

export default async function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirectToLogout(PUBLIC_SITE_URL);
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
    <SubscriptionProvider>
      <WorkspaceShell
        orgName={tenant?.name ?? "Your workspace"}
        tenantId={authContext.tenantId}
        roleLabel={roleLabel}
        role={authContext.role}
        canSendInvites={
          authContext.role === "admin" || authContext.role === "manager"
        }
        canExportGst={
          authContext.role === "admin" ||
          authContext.role === "manager" ||
          (user?.can_export_gst ?? false)
        }
        userLabel={displayName || "Workspace user"}
      >
        {children}
      </WorkspaceShell>
    </SubscriptionProvider>
  );
}
