"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/inbox", label: "Inbox", icon: Inbox, exact: false },
  { href: "/inquiries", label: "Inquiries", icon: MessageSquare, exact: false },
  { href: "/accounts", label: "Accounts", icon: Users, exact: false },
];

function NavLink({
  href,
  label,
  icon: Icon,
  exact,
  pathname,
}: (typeof navItems)[0] & { pathname: string }) {
  const active = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-700 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function SidebarContent({
  adminName,
  adminEmail,
  loggingOut,
  onClose,
  onLogout,
  pathname,
}: {
  adminName: string;
  adminEmail: string;
  loggingOut: boolean;
  onClose: () => void;
  onLogout: () => void;
  pathname: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-slate-800 px-5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">Spendly</span>
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
            Admin
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-500 hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} pathname={pathname} />
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 min-w-0 space-y-0.5">
          <p className="truncate text-xs font-medium text-white">{adminName}</p>
          <p className="truncate text-xs text-slate-500">{adminEmail}</p>
        </div>
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

interface AdminShellProps {
  adminName: string;
  adminEmail: string;
  children: React.ReactNode;
}

export function AdminShell({
  adminName,
  adminEmail,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPending] = useTransition();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 bg-slate-950 lg:flex lg:flex-col">
        <SidebarContent
          adminName={adminName}
          adminEmail={adminEmail}
          loggingOut={loggingOut}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
          pathname={pathname}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-950 shadow-xl">
            <SidebarContent
              adminName={adminName}
              adminEmail={adminEmail}
              loggingOut={loggingOut}
              onClose={() => setSidebarOpen(false)}
              onLogout={handleLogout}
              pathname={pathname}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar — mobile + loading indicator */}
        <header className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="ml-3 text-sm font-semibold text-slate-950 lg:hidden">
            Spendly Admin
          </span>

          {/* Page-transition loading bar */}
          {isPending && (
            <div className="absolute left-0 top-14 h-0.5 w-full overflow-hidden">
              <div className="h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] bg-slate-950" />
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
