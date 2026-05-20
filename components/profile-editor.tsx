"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

type User = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  timezone?: string | null;
};

type Tenant = {
  id: string;
  name?: string | null;
  country_code?: string | null;
};

export default function ProfileEditor({
  user,
  tenant,
  role,
}: {
  user: User;
  tenant: Tenant;
  role: string;
}) {
  const displayName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  const canEditOrg = role === "admin";

  const [editOrgName, setEditOrgName] = useState(tenant.name ?? "");
  const [countryCode, setCountryCode] = useState(tenant.country_code ?? "");
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [orgMessage, setOrgMessage] = useState("");

  const [editName, setEditName] = useState(displayName);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userMessage, setUserMessage] = useState("");

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const saveOrgProfile = async () => {
    setIsSavingOrg(true);
    setOrgMessage("");
    try {
      const res = await fetch("/api/tenant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: editOrgName,
          countryCode,
        }),
      });
      if (res.ok) {
        setOrgMessage("Organization updated successfully");
        setTimeout(() => setOrgMessage(""), 3000);
      } else {
        const err = await res.json();
        setOrgMessage(err.error?.message || "Failed to update");
      }
    } catch {
      setOrgMessage("Error updating organization");
    } finally {
      setIsSavingOrg(false);
    }
  };

  const saveUserProfile = async () => {
    setIsSavingUser(true);
    setUserMessage("");
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName }),
      });
      if (res.ok) {
        setUserMessage("Profile updated successfully");
        setTimeout(() => setUserMessage(""), 3000);
      } else {
        const err = await res.json();
        setUserMessage(err.error?.message || "Failed to update");
      }
    } catch {
      setUserMessage("Error updating profile");
    } finally {
      setIsSavingUser(false);
    }
  };

  const changePassword = async () => {
    setPasswordMessage("");
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters");
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/users/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordMessage("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          setShowPasswordForm(false);
          setPasswordMessage("");
        }, 2000);
      } else {
        const err = await res.json();
        setPasswordMessage(err.error?.message || "Failed to change password");
      }
    } catch {
      setPasswordMessage("Error changing password");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {canEditOrg && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950 mb-6">
            Organization Profile
          </h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Organization Name
              </label>
              <input
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Enter organization name"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Country Code
              </label>
              <input
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                maxLength={2}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g., IN, US, GB"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Tenant ID (Read-only)
              </label>
              <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {tenant.id}
              </div>
            </div>

            {orgMessage && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200">
                {orgMessage}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveOrgProfile}
                disabled={isSavingOrg}
                className="rounded-md bg-slate-950 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {isSavingOrg ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950 mb-4">
          User Profile
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {user.email}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Role</label>
            <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Timezone
            </label>
            <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {user.timezone || "Not set"}
            </div>
          </div>

          {userMessage && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 border border-green-200">
              {userMessage}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={saveUserProfile}
              disabled={isSavingUser}
              className="rounded-md bg-slate-950 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {isSavingUser ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-950">Security</h2>
          </div>
        </div>

        {!showPasswordForm ? (
          <button
            onClick={() => setShowPasswordForm(true)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Change Password
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Enter your current password"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Enter new password (min 8 characters)"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Confirm new password"
              />
            </div>

            {passwordMessage && (
              <div
                className={`rounded-md p-3 text-sm border ${
                  passwordMessage.includes("successfully")
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {passwordMessage}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={changePassword}
                disabled={isSavingPassword}
                className="rounded-md bg-slate-950 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
              >
                {isSavingPassword ? "Updating..." : "Update Password"}
              </button>
              <button
                onClick={() => {
                  setShowPasswordForm(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordMessage("");
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
