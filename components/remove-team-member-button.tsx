"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

type RemoveTeamMemberButtonProps = {
  memberId: string;
};

export function RemoveTeamMemberButton({
  memberId,
}: RemoveTeamMemberButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(
          payload.error?.message || "Failed to remove team member",
        );
      }

      setShowConfirm(false);
      // Refresh the page to show updated team members list
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-red-600">Confirm removal?</p>
        <div className="flex gap-1">
          <button
            onClick={handleRemove}
            disabled={isLoading}
            className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            title="Confirm removal"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setShowConfirm(false);
              setError(null);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
            title="Cancel"
          >
            ✕
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
      title="Remove member"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
