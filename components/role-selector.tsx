"use client";

import { useState } from "react";

type RoleSelectorProps = {
  memberId: string;
  initialRole: "employee" | "manager";
  disabled?: boolean;
  onRoleChange?: (role: "employee" | "manager") => void;
};

export function RoleSelector({
  memberId,
  initialRole,
  disabled,
  onRoleChange,
}: RoleSelectorProps) {
  const [role, setRole] = useState(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (nextRole: "employee" | "manager") => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/teams/members/${memberId}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error?.message || "Failed to update role");
      }

      setRole(nextRole);
      onRoleChange?.(nextRole);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-slate-700">Role</label>
        <select
          value={role}
          onChange={(e) => void handleChange(e.target.value as "employee" | "manager")}
          disabled={isLoading || disabled}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
        >
          <option value="employee">Employee</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
