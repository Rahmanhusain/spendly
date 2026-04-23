"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, Settings, User, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";

type WorkspaceTopNavProps = {
  orgName: string;
  tenantId: string;
  roleLabel: string;
  userLabel: string;
};

export function WorkspaceTopNav({
  orgName,
  tenantId,
  roleLabel,
  userLabel,
}: WorkspaceTopNavProps) {
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const notifications = [
    {
      title: "Approval pending",
      detail: "3 reports are waiting for manager review.",
      time: "2 min ago",
    },
    {
      title: "Expense policy alert",
      detail: "2 new policy violations were flagged today.",
      time: "15 min ago",
    },
    {
      title: "Invite accepted",
      detail: "A new teammate joined your workspace.",
      time: "1 hour ago",
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/workspace" className="flex items-center gap-3">
          <Image
            src="/logo/logo.png"
            alt="Spendly logo"
            width={180}
            height={42}
            className="h-8 w-auto"
            priority
          />
          <span className="hidden text-sm font-medium text-slate-600 sm:inline">
            {orgName}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <details className="group relative">
            <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
              <Bell className="h-5 w-5" />
            </summary>

            <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-950">
                  Notifications
                </p>
                <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                  {notifications.length} new
                </Badge>
              </div>

              <div className="space-y-2">
                {notifications.map((notification) => (
                  <article
                    key={notification.title}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {notification.detail}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      {notification.time}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </details>

          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-sm transition-colors",
                isProfileMenuOpen
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
              )}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            {isProfileMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="rounded-xl bg-slate-950 px-4 py-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
                      <UserCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{userLabel}</p>
                      <p className="text-xs text-slate-300">{orgName}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex flex-wrap gap-2 px-1 pb-1">
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      Tenant: {tenantId}
                    </Badge>
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      Role: {roleLabel}
                    </Badge>
                  </div>

                  <Link
                    href="/workspace/settings"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition-colors hover:bg-slate-50"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    Profile settings
                  </Link>
                  <Link
                    href="/workspace"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition-colors hover:bg-slate-50"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <User className="h-4 w-4 text-slate-500" />
                    Open dashboard
                  </Link>
                  <div className="rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                    <LogoutButton className="w-full justify-start border-0 bg-transparent p-0 text-left text-slate-800 shadow-none hover:bg-transparent" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
