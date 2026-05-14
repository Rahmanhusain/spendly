"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

type Props = {
  dateRange: string;
  startDate?: string;
  endDate?: string;
};

export function DashboardExportButton({ dateRange, startDate, endDate }: Props) {
  const [loading, setLoading] = useState(false);

  function handleExport() {
    setLoading(true);

    const params = new URLSearchParams({ dateRange });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    // Open the print-ready page in a new tab.
    // The page auto-triggers window.print() so the browser PDF dialog opens immediately.
    const tab = window.open(`/api/dashboard/export?${params.toString()}`, "_blank");

    // Re-enable the button once the new tab has loaded (or after a timeout)
    if (tab) {
      const timer = setTimeout(() => setLoading(false), 2000);
      tab.addEventListener("load", () => {
        clearTimeout(timer);
        setLoading(false);
      });
    } else {
      // Popup blocked — still reset state
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={loading}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      Export summary
    </button>
  );
}
