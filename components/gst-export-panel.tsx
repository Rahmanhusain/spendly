"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GstExportPanelProps = {
  canExport: boolean;
};

type ApiErrorPayload = {
  error?: string | { message?: string; reason?: string; code?: string };
  message?: string;
};

function getApiErrorMessage(
  payload: ApiErrorPayload | null | undefined,
  fallback: string,
) {
  if (!payload) return fallback;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error === "object") {
    return (
      payload.error.message ||
      payload.error.reason ||
      payload.error.code ||
      fallback
    );
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return fallback;
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getDefaultReportRange() {
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    start: formatIsoDate(currentMonthStart),
    end: formatIsoDate(today),
  };
}

export function GstExportPanel({ canExport }: GstExportPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [start, setStart] = useState(() => getDefaultReportRange().start);
  const [end, setEnd] = useState(() => getDefaultReportRange().end);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("gst-report.html");

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        window.URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const closeModal = () => {
    setIsOpen(false);
    setErrorMessage("");
  };

  const handleExport = async () => {
    setErrorMessage("");

    if (!start || !end) {
      setErrorMessage("Select both start and end dates.");
      return;
    }

    if (start > end) {
      setErrorMessage("Start date must be on or before end date.");
      return;
    }

    setIsExporting(true);

    try {
      const response = await fetch("/api/compliance/gst-report/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ start, end }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string | { message?: string; reason?: string; code?: string };
          message?: string;
        };
        throw new Error(
          getApiErrorMessage(payload, "Failed to export GST report."),
        );
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] ?? `gst-report-${start}-${end}.html`;

      if (downloadUrl) {
        window.URL.revokeObjectURL(downloadUrl);
      }

      setDownloadUrl(objectUrl);
      setDownloadName(filename);
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to export GST report.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (!canExport) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">GST export</h2>
            <p className="mt-1 text-sm text-slate-600">
              Ask an admin or manager to generate the compliance export.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="gst-export"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">GST export</h2>
            <p className="mt-1 text-sm text-slate-600">
              Generate a GST-ready export for your accountant. Pick a period and
              download the report.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={downloadName}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Download report
            </a>
          ) : null}
          <Button type="button" onClick={() => setIsOpen(true)}>
            Export GST report
          </Button>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gst-export-title"
            className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="gst-export-title"
                  className="text-xl font-semibold text-slate-950"
                >
                  Export GST compliance report
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Choose the reporting period. The export will include category
                  totals and vendor breakdowns.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50"
                aria-label="Close GST export dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Start date
                </span>
                <Input
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  End date
                </span>
                <Input
                  type="date"
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              This export is designed for accountant handoff. It uses the
              current tenant’s receipts and logs the export record
              automatically.
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button variant="outline" type="button" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleExport();
                }}
                disabled={isExporting}
              >
                {isExporting ? "Generating..." : "Generate export"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
