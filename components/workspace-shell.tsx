"use client";

import { PolicySetupToast } from "@/components/policy-setup-toast";
import { WorkspaceSidePanel } from "@/components/workspace-side-panel";
import { WorkspaceTopNav } from "@/components/workspace-top-nav";

type WorkspaceShellProps = {
  orgName: string;
  tenantId: string;
  roleLabel: string;
  role: string;
  canSendInvites: boolean;
  canExportGst: boolean;
  userLabel: string;
  children: React.ReactNode;
};

export function WorkspaceShell({
  orgName,
  tenantId,
  roleLabel,
  role,
  canSendInvites,
  canExportGst,
  userLabel,
  children,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <WorkspaceTopNav
        orgName={orgName}
        tenantId={tenantId}
        roleLabel={roleLabel}
        userLabel={userLabel}
      />

      <div className="grid w-full gap-0 lg:grid-cols-[280px_1fr]">
        <WorkspaceSidePanel
          orgName={orgName}
          tenantId={tenantId}
          roleLabel={roleLabel}
          role={role}
          canSendInvites={canSendInvites}
          canExportGst={canExportGst}
        />

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <PolicySetupToast />
    </div>
  );
}
