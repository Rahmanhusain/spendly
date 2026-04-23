"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type InviteRecord = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
};

export default function TeamSetupPage() {
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<
    "employee" | "manager" | "admin"
  >("employee");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [recentInvites, setRecentInvites] = useState<InviteRecord[]>([]);

  useEffect(() => {
    const loadInvites = async () => {
      try {
        const response = await fetch("/api/teams/invites");

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        setRecentInvites(data.data?.invites ?? []);
      } catch {
        // Background fetch only.
      }
    };

    void loadInvites();
  }, []);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    setInviteLink("");
    setCopyState("idle");

    try {
      const response = await fetch("/api/teams/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to create invite");
      }

      const data = await response.json();
      const createdInvite = data.data?.invite as InviteRecord | undefined;

      setSuccess(
        `Invite ready for ${inviteEmail}. The teammate can join from the emailed link.`,
      );
      setInviteLink(data.data?.inviteLink ?? "");
      setInviteEmail("");

      if (createdInvite) {
        setRecentInvites((current) => [createdInvite, ...current]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Team setup
          </p>
          <Link
            href="/workspace"
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            Back to app
          </Link>
        </div>

        <Card className="p-6">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Invitations
            </p>
            <h1 className="text-2xl font-bold text-slate-950">
              Invite teammates by email
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              Create workspace access for a teammate without a separate team
              setup step.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handleCreateInvite} className="space-y-4">
            <div>
              <Label htmlFor="email">Team Member Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="member@company.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(
                    e.target.value as "employee" | "manager" | "admin",
                  )
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending..." : "Send email invite"}
            </Button>
          </form>

          {inviteLink ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-950">Invite link</p>
              <p className="mt-1 break-all">{inviteLink}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteLink);
                    setCopyState("copied");
                  }}
                >
                  {copyState === "copied" ? "Copied" : "Copy link"}
                </Button>
                <Link
                  href="/workspace"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-900"
                >
                  Back to app
                </Link>
              </div>
              <p className="mt-2 text-slate-600">
                Share this link through email if you are testing locally.
              </p>
            </div>
          ) : null}

          <div className="mt-6 border-t border-slate-200 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-950">
                Recent invites
              </p>
              <Link
                href="/workspace/invites"
                className="text-sm font-medium text-slate-600 hover:text-slate-950"
              >
                View all
              </Link>
            </div>

            {recentInvites.length > 0 ? (
              <div className="space-y-2">
                {recentInvites.slice(0, 3).map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-950">
                        {invite.email}
                      </span>
                      <span className="text-slate-500">{invite.role}</span>
                    </div>
                    <p className="mt-1 text-slate-500">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No invites sent yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
