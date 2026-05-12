"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  ClipboardList,
  FileSpreadsheet,
  Inbox,
  LayoutDashboard,
  MailPlus,
  ReceiptText,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PolicySetupToast } from "@/components/policy-setup-toast";
import { WorkspaceTopNav } from "@/components/workspace-top-nav";

type WorkspaceShellProps = {
  orgName: string;
  tenantId: string;
  roleLabel: string;
  canSendInvites: boolean;
  canExportGst: boolean;
  userLabel: string;
  children: React.ReactNode;
};

const navigationItems = [
  {
    label: "Dashboard",
    href: "/workspace",
    icon: LayoutDashboard,
    description: "Overview and metrics",
  },
  {
    label: "Upload receipt",
    href: "/workspace/upload-receipt",
    icon: Upload,
    description: "Capture bills quickly",
  },
  {
    label: "Reports",
    href: "/workspace/reports",
    icon: ClipboardList,
    description: "Track approvals & report progress",
  },
  {
    label: "View all receipts",
    href: "/workspace/receipts",
    icon: ReceiptText,
    description: "Search, filter, and inspect receipts",
  },
  {
    label: "Policies",
    href: "/workspace/policies",
    icon: ShieldAlert,
    description: "Configure limits and warnings",
  },
  {
    label: "GST export",
    href: "/workspace/gst",
    icon: FileSpreadsheet,
    description: "Generate compliance-ready reports",
    requiresGstAccess: true,
  },
  {
    label: "Open invites",
    href: "/workspace/invites",
    icon: Inbox,
    description: "See incoming workspace invites",
    requiresInviteAccess: true,
  },
];

export function WorkspaceShell({
  orgName,
  tenantId,
  roleLabel,
  canSendInvites,
  canExportGst,
  userLabel,
  children,
}: WorkspaceShellProps) {
  const pathname = usePathname();
  const visibleNavigationItems = navigationItems.filter(
    (item) =>
      (!item.requiresInviteAccess || canSendInvites) &&
      (!item.requiresGstAccess || canExportGst),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <WorkspaceTopNav
        orgName={orgName}
        tenantId={tenantId}
        roleLabel={roleLabel}
        userLabel={userLabel}
      />

      <div className="grid w-full gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-5 py-5">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Workspace
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              {orgName}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                Tenant: {tenantId.slice(0, 8)}...
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {roleLabel}
              </span>
            </div>
          </div>

          <nav className="space-y-1 p-3">
            {visibleNavigationItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/workspace"
                  ? pathname === "/workspace"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                    isActive
                      ? "border-slate-900 bg-slate-950 text-white"
                      : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                      isActive
                        ? "bg-white/10 text-white"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "block text-xs",
                        isActive ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                  <ArrowUpRight
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isActive
                        ? "text-white/80"
                        : "text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
                    )}
                  />
                </Link>
              );
            })}
          </nav>

          {canSendInvites ? (
            <div className="m-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                  <MailPlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-950">
                    Invite teammates
                  </p>
                  <p className="text-xs leading-5 text-slate-500">
                    Keep approvals moving with team access.
                  </p>
                </div>
              </div>
              <Link
                href="/team-setup"
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100"
              >
                Invite teammates
              </Link>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <PolicySetupToast />
    </div>
  );
}
