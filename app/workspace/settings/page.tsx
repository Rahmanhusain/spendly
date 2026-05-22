import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BadgeHelp,
  BellRing,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ProfileEditor from "@/components/profile-editor";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { LogoutButton } from "@/components/logout-button";
import SettingsLoading from "./loading";
import type { AuthContext } from "@/lib/middleware/auth";

// ─── Data component — suspends while fetching ────────────────────────────────
async function SettingsData({ authContext }: { authContext: AuthContext }) {
  const [user, tenant] = await Promise.all([
    getUserById(authContext.userId),
    getTenantById(authContext.tenantId),
  ]);

  const summaryCards: Array<{
    title: string;
    detail: string;
    icon: LucideIcon;
  }> = [
    { title: "Account ready", detail: "Signed in and active", icon: UserCircle2 },
    { title: "Security", detail: "Session protected", icon: LockKeyhole },
    { title: "Workspace", detail: "15-day full-feature trial", icon: Settings2 },
    {
      title: "Notifications",
      detail: user?.email_summary_enabled ? "On" : "Off",
      icon: BellRing,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 bg-white px-6 py-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Profile settings
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
              Workspace settings
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review your account, workspace, and security settings in one place.
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map(({ title, detail, icon: Icon }) => (
            <Card key={title} className="border-slate-200 shadow-sm">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-950">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{detail}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="px-6 py-0 lg:px-8 lg:py-0">
        <ProfileEditor user={user!} tenant={tenant!} role={authContext.role} />
      </div>

      <section className="border-t border-slate-200 bg-white px-6 py-6 lg:px-8 lg:py-8">
        <h2 className="text-lg font-semibold text-slate-950 mb-4">
          Additional Info
        </h2>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                <LockKeyhole className="h-5 w-5 text-slate-500" />
                Security settings
              </CardTitle>
              <CardDescription>
                Session and permission management controls.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>Session authentication is enabled for this workspace.</p>
              <p>Password changes require OTP verification by email.</p>
              <p>Invite teammates from the team setup page as needed.</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Notifications and reports
              </CardTitle>
              <CardDescription>
                Preferences for updates and monthly summaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>Email summary status: {user?.email_summary_enabled ? "On" : "Off"}</p>
              <p>Weekly spend digest can be configured in upcoming releases.</p>
              <p>
                Compliance and GST exports remain available from workspace tools.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                <BadgeHelp className="h-5 w-5 text-slate-500" />
                Support
              </CardTitle>
              <CardDescription>
                Quick links for help and workspace guidance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Protected by session authentication.
              </p>
              <p className="inline-flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                Workspace controls stay tenant-scoped.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// ─── Page — auth only, renders instantly ─────────────────────────────────────
export default async function WorkspaceSettingsPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/api/auth/logout?next=/login");
  }

  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsData authContext={authContext} />
    </Suspense>
  );
}
