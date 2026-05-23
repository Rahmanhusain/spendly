import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { redirectToLogin } from "@/lib/auth/redirect";
import {
  getTeamMembersByTenant,
  getTeamInvites,
} from "@/lib/repositories/teamRepository";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RemoveTeamMemberButton } from "@/components/remove-team-member-button";
import { RemoveInviteButton } from "@/components/remove-invite-button";
import { GstPermissionToggle } from "@/components/gst-permission-toggle";
import { RoleSelector } from "@/components/role-selector";
import InvitesLoading from "./loading";
import type { AuthContext } from "@/lib/middleware/auth";

export const metadata = buildPageMetadata({
  title: "Team members & invites",
  description:
    "Manage workspace members, pending invites, and access controls.",
});

// ─── Data component — suspends while fetching ────────────────────────────────
async function InvitesData({ authContext }: { authContext: AuthContext }) {
  const canManageMembers =
    authContext.role === "admin" || authContext.role === "manager";
  const canDeleteMembers = authContext.role === "admin";

  const [teamMembers, invitedMembers] = await Promise.all([
    getTeamMembersByTenant(authContext.tenantId),
    getTeamInvites(authContext.tenantId),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Team & Invites
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Manage workspace members.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              View team members, pending invites, and manage access.
            </p>
          </div>
          {canManageMembers && (
            <Link
              href="/team-setup"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
            >
              Invite teammates
            </Link>
          )}
        </div>

        <div className="mt-6 space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {/* Current Team Members */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Team members ({teamMembers.length})
              </CardTitle>
              <CardDescription>Current workspace members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.length > 0 ? (
                teamMembers.map((member) => (
                  <article
                    key={member.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-slate-950">
                          {member.first_name || member.last_name
                            ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
                            : member.email}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {member.email}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {member.role.charAt(0).toUpperCase() +
                            member.role.slice(1)}{" "}
                          · Joined{" "}
                          {new Date(member.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="border-slate-200 bg-emerald-50 text-emerald-700">
                          Active
                        </Badge>
                        {canDeleteMembers &&
                          member.id !== authContext.userId && (
                            <RemoveTeamMemberButton memberId={member.id} />
                          )}
                      </div>
                    </div>
                    {authContext.role === "admin" &&
                      member.id !== authContext.userId &&
                      member.role !== "admin" && (
                        <>
                          <div className="mt-3 border-t border-slate-100 pt-3">
                            <GstPermissionToggle
                              memberId={member.id}
                              initialValue={member.can_export_gst}
                            />
                          </div>
                          <RoleSelector
                            memberId={member.id}
                            initialRole={member.role}
                          />
                        </>
                      )}
                  </article>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-slate-500">
                  No team members yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pending Invites */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">
                Pending invites ({invitedMembers.length})
              </CardTitle>
              <CardDescription>
                Members who haven&apos;t accepted yet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitedMembers.length > 0 ? (
                invitedMembers.map((invite) => (
                  <article
                    key={invite.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-950">
                        {invite.email}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {invite.role.charAt(0).toUpperCase() +
                          invite.role.slice(1)}{" "}
                        role
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Invited{" "}
                        {new Date(invite.created_at).toLocaleDateString()} ·
                        Expires{" "}
                        {new Date(invite.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="border-slate-200 bg-yellow-50 text-yellow-700">
                        Pending
                      </Badge>
                      {canManageMembers && (
                        <RemoveInviteButton inviteId={invite.id} />
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-slate-500">
                  No pending invites
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// ─── Page — auth only, renders instantly ─────────────────────────────────────
export default async function InvitesPage() {
  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirectToLogin();
  }

  return (
    <Suspense fallback={<InvitesLoading />}>
      <InvitesData authContext={authContext} />
    </Suspense>
  );
}
