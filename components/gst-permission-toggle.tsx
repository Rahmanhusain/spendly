"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";

type GstPermissionToggleProps = {
  memberId: string;
  initialValue: boolean;
  /** When true, shows enabled and prevents toggling (e.g. managers always have GST export). */
  forceEnabled?: boolean;
};

export function GstPermissionToggle({
  memberId,
  initialValue,
  forceEnabled = false,
}: GstPermissionToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayEnabled = forceEnabled || enabled;

  useEffect(() => {
    if (forceEnabled) {
      setEnabled(true);
    }
  }, [forceEnabled]);

  const handleToggle = async () => {
    if (forceEnabled) return;
    const next = !enabled;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/teams/members/${memberId}/permissions`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ can_export_gst: next }),
        },
      );

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(
          payload.error?.message || "Failed to update permission",
        );
      }

      setEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-700">
            GST export access
          </span>
        </div>
        <button
          role="switch"
          aria-checked={displayEnabled}
          onClick={() => { void handleToggle(); }}
          disabled={isLoading || forceEnabled}
          title={
            forceEnabled
              ? "Managers always have GST export access"
              : displayEnabled
                ? "Revoke GST export access"
                : "Grant GST export access"
          }
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            displayEnabled ? "bg-emerald-500" : "bg-slate-200"
          }`}
        >
          <span
            className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
              displayEnabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
