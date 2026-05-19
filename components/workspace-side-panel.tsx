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

type WorkspaceSidePanelProps = {
  orgName: string;
  tenantId: string;
  roleLabel: string;
  role: string;
  canSendInvites: boolean;
  canExportGst: boolean;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  requiresGstAccess?: boolean;
  requiresInviteAccess?: boolean;
  requiresManagerAccess?: boolean;
};

const navigationItems: NavigationItem[] = [
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
    requiresManagerAccess: true,
  },
  {
    label: "GST export",
    href: "/workspace/gst",
    icon: FileSpreadsheet,
    description: "Generate compliance-ready reports",
    requiresGstAccess: true,
  },
  {
    label: "Team & invites",
    href: "/workspace/invites",
    icon: Inbox,
    description: "View workspace team and pending invites",
    requiresManagerAccess: true,
  },
];

export function WorkspaceSidePanel({
  orgName,
  tenantId,
  roleLabel,
  role,
  canSendInvites,
  canExportGst,
}: WorkspaceSidePanelProps) {
  const pathname = usePathname();
  const isManager = role === "admin" || role === "manager";

  const visibleNavigationItems = navigationItems.filter(
    (item) =>
      (!item.requiresGstAccess || canExportGst) &&
      (!item.requiresManagerAccess || isManager),
  );

  return (
    <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:self-start lg:border-b-0 lg:border-r">
      <div className="lg:flex lg:h-[calc(100vh-4rem)] lg:flex-col">
        <div className="shrink-0 border-b border-slate-200 px-5 py-5">
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

        <div className="p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <nav className="space-y-1">
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
                    "group relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-200 ease-out hover:shadow-md",
                    isActive
                      ? "border-slate-900 bg-slate-950 text-white shadow-lg"
                      : "border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:translate-x-0.5",
                  )}
                >
                  {/* Active indicator animation */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 transform rounded-r-full bg-white/30 animate-pulse"></div>
                  )}

                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                      isActive
                        ? "bg-white/10 text-white scale-110"
                        : "bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:scale-105",
                    )}
                  >
                    <Icon className="h-4 w-4 transition-transform duration-200" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium transition-colors duration-200">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "block text-xs transition-colors duration-200",
                        isActive ? "text-slate-300" : "text-slate-500",
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                  <div className="flex items-center gap-2 overflow-hidden">
                    <ArrowUpRight
                      className={cn(
                        "h-4 w-4 transition-all duration-300",
                        isActive
                          ? "text-white/80 translate-x-0.5 -translate-y-0.5 opacity-100"
                          : "text-slate-400 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:opacity-100 opacity-60",
                      )}
                    />
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {canSendInvites ? (
          <div className="shrink-0 border-t border-slate-200 p-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all duration-300 hover:shadow-md hover:border-slate-300">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white transition-all duration-300 group-hover:scale-110">
                  <MailPlus className="h-5 w-5 transition-transform duration-300" />
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
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-all duration-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 hover:shadow-md hover:scale-105 active:scale-100"
              >
                Invite teammates
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
