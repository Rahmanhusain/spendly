"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  User,
  AlertTriangle,
} from "lucide-react";
import type { TenantRecord } from "../lib/repositories/authRepository";
import type { AdminUserRecord } from "../lib/repositories/adminRepository";
import { RefreshButton } from "./refresh-button";

const TENANT_STATUS_PILL: Record<string, string> = {
  active: "bg-slate-950 text-white",
  inactive: "bg-slate-200 text-slate-600",
  suspended: "bg-slate-100 text-slate-500",
};

const USER_STATUS_PILL: Record<string, string> = {
  active: "bg-slate-100 text-slate-700",
  inactive: "bg-slate-50 text-slate-400 border border-slate-200",
  suspended: "bg-slate-50 text-slate-400 border border-slate-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Confirm dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
            <AlertTriangle className="h-4 w-4 text-slate-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
            className="rounded-full border-slate-200"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-full bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Confirming…
              </span>
            ) : (
              "Confirm"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Password dialog ───────────────────────────────────────────────────────────
function PasswordDialog({
  userName,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  userName: string;
  onConfirm: (pw: string) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-sm font-semibold text-slate-950">Reset password</p>
        <p className="mt-1 text-sm text-slate-600">
          New password for <strong>{userName}</strong>. All their sessions will
          be revoked.
        </p>
        <Input
          type="password"
          placeholder="Min 8 characters"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="mt-4 h-10 rounded-lg border-slate-200 text-sm"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={loading}
            className="rounded-full border-slate-200"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(pw)}
            disabled={loading || pw.length < 8}
            className="rounded-full bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Reset password"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
type DialogState =
  | { type: "tenant_activate" }
  | { type: "tenant_deactivate" }
  | { type: "user_password"; userId: string; userName: string }
  | null;

interface Props {
  tenant: TenantRecord;
  users: AdminUserRecord[];
  total: number;
  offset: number;
  limit: number;
  search: string;
}

export function TenantDetailClient({
  tenant,
  users,
  total,
  offset,
  limit,
  search,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Debounced user search
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, offset: "0" });
    }, 400);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams({
      ...(searchInput && { search: searchInput }),
      offset: String(offset),
      ...params,
    });
    [...sp.keys()].forEach((k) => {
      if (!sp.get(k)) sp.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  async function patchTenant(status: "active" | "inactive") {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/accounts/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update workspace status.");
      setDialog(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function patchUserPassword(userId: string, newPassword: string) {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/accounts/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          new_password: newPassword,
        }),
      });
      if (!res.ok) throw new Error("Failed to reset password.");
      setDialog(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setActionLoading(false);
    }
  }

  const isActive = tenant.status === "active";

  return (
    <>
      {dialog?.type === "tenant_activate" && (
        <ConfirmDialog
          title="Activate workspace?"
          message={`This will reactivate "${tenant.name}". Users will be able to log in again.`}
          onConfirm={() => patchTenant("active")}
          onCancel={() => setDialog(null)}
          loading={actionLoading}
        />
      )}
      {dialog?.type === "tenant_deactivate" && (
        <ConfirmDialog
          title="Deactivate workspace?"
          message={`This will deactivate "${tenant.name}". All users will be signed out and cannot log in until reactivated.`}
          onConfirm={() => patchTenant("inactive")}
          onCancel={() => setDialog(null)}
          loading={actionLoading}
        />
      )}
      {dialog?.type === "user_password" && (
        <PasswordDialog
          userName={dialog.userName}
          onConfirm={(pw) => patchUserPassword(dialog.userId, pw)}
          onCancel={() => setDialog(null)}
          loading={actionLoading}
          error={actionError}
        />
      )}

      <div className="space-y-5">
        {/* Back */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            All accounts
          </Link>
          <RefreshButton />
        </div>

        {/* Workspace card */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl text-slate-950">
                    {tenant.name}
                  </CardTitle>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${TENANT_STATUS_PILL[tenant.status] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {tenant.status}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">
                    {tenant.plan}
                  </span>
                </div>
                <CardDescription>
                  <span className="font-mono">{tenant.slug}</span>
                  {" · "}
                  {tenant.country_code}
                  {" · "}Created {formatDate(tenant.created_at)}
                </CardDescription>
                {tenant.trial_ends_at && (
                  <p className="text-xs text-slate-500">
                    Trial ends: {formatDate(tenant.trial_ends_at)}
                  </p>
                )}
              </div>

              {/* Only activate / deactivate — no suspend */}
              <div className="flex shrink-0 gap-2">
                {isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ type: "tenant_deactivate" })}
                    className="h-8 rounded-full border-slate-200 text-xs"
                  >
                    Deactivate workspace
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialog({ type: "tenant_activate" })}
                    className="h-8 rounded-full border-slate-200 text-xs"
                  >
                    Activate workspace
                  </Button>
                )}
              </div>
            </div>

            {!isActive && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                <p className="text-xs text-slate-600">
                  <span className="font-semibold">Workspace is inactive.</span>{" "}
                  Users cannot log in until this workspace is reactivated.
                </p>
              </div>
            )}
          </CardHeader>

          {/* Users */}
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm font-semibold text-slate-950">
                Users{" "}
                <span className="font-normal text-slate-500">({total})</span>
              </p>
              <div className="relative sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search users…"
                  className="h-8 rounded-lg border-slate-200 pl-9 text-sm"
                />
              </div>
            </div>

            <Separator />

            {users.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <User className="h-7 w-7 text-slate-300" />
                <p className="text-sm text-slate-500">No users found.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {users.map((user) => {
                  const displayName =
                    [user.first_name, user.last_name]
                      .filter(Boolean)
                      .join(" ") || user.email;
                  return (
                    <li
                      key={user.id}
                      className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-slate-950">
                              {displayName}
                            </p>
                            <Badge
                              className={`border-0 text-xs ${USER_STATUS_PILL[user.status] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {user.status}
                            </Badge>
                            <span className="rounded border border-slate-200 px-1.5 py-0.5 text-xs capitalize text-slate-500">
                              {user.role}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {user.email}
                          </p>
                        </div>
                      </div>

                      {/* Only password reset — no deactivate on users */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDialog({
                            type: "user_password",
                            userId: user.id,
                            userName: displayName,
                          })
                        }
                        className="h-7 shrink-0 rounded-full border-slate-200 px-3 text-xs"
                      >
                        Reset password
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {total > limit && (
              <>
                <Separator />
                <div className="flex items-center justify-between px-5 py-3">
                  <p className="text-xs text-slate-500">
                    {offset + 1}–{Math.min(offset + limit, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset === 0 || isPending}
                      onClick={() =>
                        navigate({
                          offset: String(Math.max(0, offset - limit)),
                        })
                      }
                      className="h-8 rounded-lg border-slate-200 px-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-slate-600">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={offset + limit >= total || isPending}
                      onClick={() =>
                        navigate({ offset: String(offset + limit) })
                      }
                      className="h-8 rounded-lg border-slate-200 px-2"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
