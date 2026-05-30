"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function InvitePageContent() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("id");
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!inviteId || !token) {
        throw new Error("Invalid invite link");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const response = await fetch("/api/teams/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inviteId,
          token,
          firstName,
          lastName: lastName || undefined,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to accept invite");
      }

      const workspaceTarget = new URL(
        data.workspaceUrl ?? "/workspace",
        window.location.origin,
      );

      if (data.tokens?.accessToken && data.tokens?.refreshToken) {
        const bootstrapForm = document.createElement("form");
        bootstrapForm.method = "POST";
        bootstrapForm.action = `${workspaceTarget.origin}/api/auth/bootstrap`;
        bootstrapForm.style.display = "none";

        const accessTokenInput = document.createElement("input");
        accessTokenInput.type = "hidden";
        accessTokenInput.name = "accessToken";
        accessTokenInput.value = data.tokens.accessToken;

        const refreshTokenInput = document.createElement("input");
        refreshTokenInput.type = "hidden";
        refreshTokenInput.name = "refreshToken";
        refreshTokenInput.value = data.tokens.refreshToken;

        bootstrapForm.append(accessTokenInput, refreshTokenInput);
        document.body.appendChild(bootstrapForm);
        bootstrapForm.submit();
        return;
      }

      window.location.assign(workspaceTarget.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!inviteId || !token) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto mb-6 flex w-full max-w-md items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Invite
          </p>
        </div>
        <Card className="mx-auto max-w-md p-6">
          <h1 className="text-2xl font-bold mb-4">Invalid Invite</h1>
          <p className="text-gray-600">
            This invite link is missing required parameters. Please check the
            link and try again.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto mb-6 flex w-full max-w-md items-center justify-between">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Invite
        </p>
        <Link
          href="/workspace"
          className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
        >
          Back to app
        </Link>
      </div>
      <div className="max-w-md mx-auto">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6">Accept Team Invite</h1>
          <p className="mb-6 text-sm text-gray-600">
            Enter your name and a new password to join the workspace. If you
            previously had an account here, this will restore your access.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAcceptInvite} className="space-y-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Your first name"
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Accepting..." : "Accept Invite"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 px-4 py-8" />}>
      <InvitePageContent />
    </Suspense>
  );
}
