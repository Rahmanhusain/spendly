"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type GstSummary = {
  totalAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTax: number;
  receiptCount: number;
  effectiveTaxRate: number;
};

type GstVendorRow = {
  category: string | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  total_amount: string;
  total_cgst: string;
  total_sgst: string;
  total_igst: string;
  total_tax: string;
};

type GstExportHistoryRow = {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: string;
  total_cgst: string;
  total_sgst: string;
  total_igst: string;
  file_path: string | null;
  generated_at: string;
  generated_by_name: string;
  generated_by_role: string;
};

type GstReportData = {
  totals: GstSummary;
  byVendor: GstVendorRow[];
};

type ExportFormat = "pdf" | "csv" | "html";

type Props = {
  orgName: string;
  orgGstin: string | null;
  orgAddress: string | null;
  canExport: boolean;
  initialStart: string;
  initialEnd: string;
  initialSummary: GstReportData;
  initialHistory: GstExportHistoryRow[];
  initialHasMoreHistory: boolean;
};

const HISTORY_PAGE_SIZE = 5;

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getRangePreset(kind: "month" | "last-month" | "quarter") {
  const now = new Date();

  if (kind === "last-month") {
    const month = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      start: month.toISOString().slice(0, 10),
      end: new Date(now.getFullYear(), now.getMonth(), 0)
        .toISOString()
        .slice(0, 10),
    };
  }

  if (kind === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      start: new Date(now.getFullYear(), quarterStartMonth, 1)
        .toISOString()
        .slice(0, 10),
      end: now.toISOString().slice(0, 10),
    };
  }

  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    end: now.toISOString().slice(0, 10),
  };
}

export function GstComplianceWorkspace({
  orgName,
  orgGstin,
  orgAddress,
  canExport,
  initialStart,
  initialEnd,
  initialSummary,
  initialHistory,
  initialHasMoreHistory,
}: Props) {
  const router = useRouter();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [isExporting, setIsExporting] = useState(false);
  const [summary, setSummary] = useState<GstReportData>(initialSummary);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("gst-report.html");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [historyItems, setHistoryItems] =
    useState<GstExportHistoryRow[]>(initialHistory);
  const [historyOffset, setHistoryOffset] = useState(HISTORY_PAGE_SIZE);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(initialHasMoreHistory);
  const firstRenderRef = useRef(true);
  const refreshTimerRef = useRef<number | null>(null);
  const reportPeriodRef = useRef<HTMLDivElement>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const historySentinelRef = useRef<HTMLDivElement>(null);
  const historyIdsRef = useRef<Set<string>>(
    new Set(initialHistory.map((item) => item.id)),
  );

  const printReportHtml = (html: string) => {
    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.setAttribute("aria-hidden", "true");
    document.body.appendChild(printFrame);

    const cleanup = () => {
      if (printFrame.parentNode) {
        printFrame.parentNode.removeChild(printFrame);
      }
    };

    const onLoad = () => {
      const frameWindow = printFrame.contentWindow;
      if (!frameWindow) {
        cleanup();
        return;
      }

      const frameDocument = frameWindow.document;
      frameDocument.open();
      frameDocument.write(html);
      frameDocument.close();

      frameWindow.onafterprint = () => {
        cleanup();
      };

      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
        } catch {
          cleanup();
        }
      }, 300);
    };

    printFrame.onload = onLoad;
    printFrame.src = "about:blank";
  };

  const handleViewFile = (exportId: string, format: "html" | "csv" | "pdf") => {
    if (format === "pdf") {
      // Re-generate as HTML and open print dialog
      fetch(`/api/compliance/gst-report/view/${exportId}?format=html`, {
        credentials: "include",
      })
        .then((res) => res.text())
        .then((html) => printReportHtml(html))
        .catch(() => setErrorMessage("Unable to load report for printing."));
    } else if (format === "csv") {
      // Download CSV directly
      const a = document.createElement("a");
      a.href = `/api/compliance/gst-report/view/${exportId}?format=csv`;
      a.download = `gst-report.csv`;
      a.click();
    } else {
      // Open HTML in a new tab — renders in the browser
      window.open(
        `/api/compliance/gst-report/view/${exportId}?format=html`,
        "_blank",
      );
    }
  };

  const hasVerifiedReceipts = summary.totals.receiptCount > 0;
  const hasHistory = historyItems.length > 0;

  const detailRows = summary.byVendor;

  const loadMoreHistory = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.append("offset", String(historyOffset));
      params.append("limit", String(HISTORY_PAGE_SIZE));
      if (historyDateFrom) params.append("from", historyDateFrom);
      if (historyDateTo) params.append("to", historyDateTo);

      const response = await fetch(
        `/api/compliance/gst-report/history?${params.toString()}`,
        { credentials: "include" },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: GstExportHistoryRow[];
        hasMore?: boolean;
      };

      if (response.ok && payload.ok && payload.data) {
        // Filter out duplicates before appending
        const newRecords = payload.data.filter(
          (record) => !historyIdsRef.current.has(record.id),
        );

        // Add new IDs to the set
        newRecords.forEach((record) => {
          historyIdsRef.current.add(record.id);
        });

        setHistoryItems((prev) => [...prev, ...newRecords]);
        setHistoryOffset((prev) => prev + HISTORY_PAGE_SIZE);
        setHasMoreHistory(payload.hasMore ?? false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load more history.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [historyOffset, historyDateFrom, historyDateTo]);

  useEffect(() => {
    if (!hasMoreHistory || isLoadingMore) {
      return;
    }

    const scrollContainer = historyScrollRef.current;
    const sentinel = historySentinelRef.current;

    if (!scrollContainer || !sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreHistory();
        }
      },
      {
        root: scrollContainer,
        rootMargin: "120px",
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreHistory, isLoadingMore, loadMoreHistory]);

  const applyHistoryDateFilter = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append("offset", "0");
      params.append("limit", String(HISTORY_PAGE_SIZE));
      if (historyDateFrom) params.append("from", historyDateFrom);
      if (historyDateTo) params.append("to", historyDateTo);

      const response = await fetch(
        `/api/compliance/gst-report/history?${params.toString()}`,
        { credentials: "include" },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: GstExportHistoryRow[];
        hasMore?: boolean;
      };

      if (response.ok && payload.ok && payload.data) {
        setHistoryItems(payload.data);
        // Update the ID tracking set
        historyIdsRef.current.clear();
        payload.data.forEach((record) => {
          historyIdsRef.current.add(record.id);
        });
        setHistoryOffset(HISTORY_PAGE_SIZE);
        setHasMoreHistory(payload.hasMore ?? false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to filter history.",
      );
    }
  }, [historyDateFrom, historyDateTo]);

  const applyPreset = (kind: "month" | "last-month" | "quarter") => {
    const range = getRangePreset(kind);
    setStart(range.start);
    setEnd(range.end);
    setErrorMessage(null);
    setStatusMessage(null);
    // Scroll to report period card
    setTimeout(() => {
      reportPeriodRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const refreshSummary = useCallback(async () => {
    if (!start || !end || start > end) {
      setErrorMessage("Select a valid date range before refreshing.");
      return;
    }

    setErrorMessage(null);
    setStatusMessage("Refreshing GST summary...");

    try {
      const response = await fetch(
        `/api/compliance/gst-report?start=${start}&end=${end}`,
        {
          credentials: "include",
        },
      );

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: GstReportData;
        error?: string;
      };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || "Unable to load GST summary.");
      }

      setSummary(payload.data);
      setStatusMessage(
        payload.data.totals.receiptCount > 0
          ? `Loaded ${payload.data.totals.receiptCount} verified receipts for the selected period.`
          : "No verified receipts found for this period. Try a wider range or verify receipts first.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load GST summary.",
      );
    }
  }, [start, end]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }

    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = window.setTimeout(() => {
      void refreshSummary();
    }, 350);

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [refreshSummary]);

  const downloadUrlRef = useRef<string | null>(null);

  const setDownloadUrlSafe = useCallback((url: string | null) => {
    // Clean up old URL before setting new one
    if (downloadUrlRef.current && downloadUrlRef.current !== url) {
      window.URL.revokeObjectURL(downloadUrlRef.current);
    }
    downloadUrlRef.current = url;
    setDownloadUrl(url);
  }, []);

  // Clear download URL when dates change to prevent stale files
  useEffect(() => {
    if (downloadUrlRef.current) {
      window.URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
      setDownloadUrl(null);
    }
  }, [start, end]);

  const handleExport = async (format: ExportFormat = exportFormat) => {
    // Validation checks
    if (!canExport) {
      setErrorMessage("Only managers and admins can export GST reports.");
      return;
    }

    if (!start || !end) {
      setErrorMessage("Select both a start and end date.");
      return;
    }

    if (start > end) {
      setErrorMessage("Start date must be on or before end date.");
      return;
    }

    if (!hasVerifiedReceipts) {
      setErrorMessage(
        "Cannot export: No verified receipts found for the selected period. Please verify receipts or select a different date range.",
      );
      return;
    }

    setErrorMessage(null);
    setIsExporting(true);
    setStatusMessage("Generating export...");

    try {
      const response = await fetch("/api/compliance/gst-report/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start, end, format }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to export GST report.");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename =
        filenameMatch?.[1] ??
        `gst-report-${start}-${end}.${format === "csv" ? "csv" : format === "pdf" ? "pdf" : "html"}`;

      if (format === "pdf") {
        const html = await response.text();
        printReportHtml(html);

        setDownloadUrlSafe(null);
        setDownloadName(filename);
        setStatusMessage(
          "Print dialog opened. Save as PDF from your browser's print dialog.",
        );
      } else {
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);

        setDownloadUrlSafe(objectUrl);
        setDownloadName(filename);
        setStatusMessage(
          format === "csv"
            ? "CSV export is ready. Download or open it from the history below."
            : "HTML export is ready. Download or view it from the history below.",
        );
      }

      // Reset history filters and reload
      setHistoryDateFrom("");
      setHistoryDateTo("");
      setHistoryOffset(HISTORY_PAGE_SIZE);
      setHasMoreHistory(initialHasMoreHistory);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to export GST report.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.8fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              GST ready workspace
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              GST compliance center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Generate accountant-friendly export files, review tax breakdowns,
              and keep a clean history of compliance handoffs for {orgName}.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={() => applyPreset("month")}
                variant="outline"
              >
                This month
              </Button>
              <Button
                type="button"
                onClick={() => applyPreset("last-month")}
                variant="outline"
              >
                Last month
              </Button>
              <Button
                type="button"
                onClick={() => applyPreset("quarter")}
                variant="outline"
              >
                Quarter to date
              </Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Organization
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {orgName}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                GSTIN: {orgGstin?.trim() || "Not set"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {orgAddress?.trim() || "No registered address on file."}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ["Receipts in range", String(summary.totals.receiptCount)],
                ["Vendor groups", String(summary.byVendor.length)],
                ["History items", String(historyItems.length)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-xl font-semibold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          [
            "Total spend",
            formatMoney(summary.totals.totalAmount),
            "All matching receipts",
          ],
          [
            "Receipts",
            String(summary.totals.receiptCount),
            "Receipts in the selected range",
          ],
          [
            "Total tax",
            formatMoney(summary.totals.totalTax),
            "CGST + SGST + IGST",
          ],
          [
            "Tax rate",
            `${summary.totals.effectiveTaxRate.toFixed(2)}%`,
            "Effective tax on total spend",
          ],
          ["CGST", formatMoney(summary.totals.totalCgst), "Local supply tax"],
          ["SGST", formatMoney(summary.totals.totalSgst), "Local supply tax"],
          ["IGST", formatMoney(summary.totals.totalIgst), "Inter-state tax"],
        ].map(([label, value, note]) => (
          <Card key={label as string} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl tracking-tight text-slate-950">
                {value as string}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              {note as string}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card ref={reportPeriodRef} className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <CalendarDays className="h-5 w-5 text-slate-500" />
              Report period
            </CardTitle>
            <CardDescription>
              Choose a custom range or use a preset. This is the only place you
              need for GST exports now.
            </CardDescription>
          </CardHeader>
          <CardContent
            className="space-y-4 overflow-y-auto"
            style={{ maxHeight: "400px" }}
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["pdf", "PDF"],
                  ["csv", "CSV"],
                  ["html", "HTML"],
                ] as Array<[ExportFormat, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setExportFormat(value)}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    exportFormat === value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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

            <div className="flex flex-wrap gap-2">
              {(["month", "last-month", "quarter"] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {preset === "month"
                    ? "This month"
                    : preset === "last-month"
                      ? "Last month"
                      : "Quarter to date"}
                </button>
              ))}
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {statusMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {statusMessage}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => void refreshSummary()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh summary
              </Button>
              {canExport ? (
                <Button
                  type="button"
                  onClick={() => void handleExport(exportFormat)}
                  disabled={isExporting || !hasVerifiedReceipts}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting
                    ? "Generating..."
                    : `Generate ${exportFormat.toUpperCase()}`}
                </Button>
              ) : (
                <Button type="button" disabled>
                  Export disabled for your role
                </Button>
              )}
              {downloadUrl ? (
                <a
                  href={downloadUrl}
                  download={downloadName}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4" />
                  Download latest file
                </a>
              ) : null}
            </div>

            {!canExport ? (
              <p className="text-sm text-slate-600">
                Managers and admins can generate exports. You can still review
                the summary and history below.
              </p>
            ) : null}

            {!hasVerifiedReceipts ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <p className="font-medium">
                  No verified receipts in this period
                </p>
                <p className="mt-1 text-xs">
                  Try a wider date range, verify receipts, or upload new
                  expenses before generating an export.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <FileSpreadsheet className="h-5 w-5 text-slate-500" />
              Summary by vendor
            </CardTitle>
            <CardDescription>
              All grouped vendor rows for the chosen period.
            </CardDescription>
          </CardHeader>
          <CardContent
            className="space-y-3 overflow-y-auto"
            style={{ maxHeight: "500px" }}
          >
            {detailRows.length > 0 ? (
              detailRows.map((row) => (
                <div
                  key={`${row.vendor_name}-${row.category}`}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-950">
                        {row.vendor_name ?? "Unknown vendor"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.category ?? "Uncategorized"}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">
                      {formatMoney(row.total_amount)}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                    <span>CGST {formatMoney(row.total_cgst)}</span>
                    <span>SGST {formatMoney(row.total_sgst)}</span>
                    <span>IGST {formatMoney(row.total_igst)}</span>
                  </div>
                  {row.vendor_gstin ? (
                    <p className="mt-2 text-xs text-slate-500">
                      GSTIN {row.vendor_gstin}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                No grouped vendor data yet for this range. Import receipts or
                widen the date range to populate the table.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <CheckCircle2 className="h-5 w-5 text-slate-500" />
              What this export includes
            </CardTitle>
            <CardDescription>
              A practical handoff for accountants and finance teams.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>Category totals with CGST, SGST, and IGST breakup.</p>
            <p>Grouped vendor details with GSTIN when receipts captured it.</p>
            <p>
              Timestamped export history so month-end reviews stay traceable.
            </p>
            <p>Fallback states for empty periods and limited-access roles.</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <ArrowRight className="h-5 w-5 text-slate-500" />
              Export history
            </CardTitle>
            <CardDescription>
              Recent compliance handoffs generated by your workspace.
            </CardDescription>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block flex-1 sm:flex-none">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  From
                </span>
                <Input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="w-full min-w-40"
                />
              </label>
              <label className="block flex-1 sm:flex-none">
                <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  To
                </span>
                <Input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="w-full min-w-40"
                />
              </label>
              <button
                type="button"
                onClick={() => void applyHistoryDateFilter()}
                className="w-full sm:w-auto rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Filter
              </button>
              {historyDateFrom || historyDateTo ? (
                <button
                  type="button"
                  onClick={() => {
                    setHistoryDateFrom("");
                    setHistoryDateTo("");
                    setHistoryItems(initialHistory);
                    // Reset the ID tracking set
                    historyIdsRef.current.clear();
                    initialHistory.forEach((record) => {
                      historyIdsRef.current.add(record.id);
                    });
                    setHistoryOffset(HISTORY_PAGE_SIZE);
                    setHasMoreHistory(
                      initialHistory.length >= HISTORY_PAGE_SIZE,
                    );
                  }}
                  className="w-full sm:w-auto rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <div
              ref={historyScrollRef}
              className="space-y-3 overflow-y-auto"
              style={{ maxHeight: "500px" }}
            >
              {hasHistory ? (
                <div className="space-y-3">
                  {historyItems.map((entry) => {
                    const fileUrl = entry.file_path ?? null;
                    void fileUrl; // kept for potential future use
                    return (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-950">
                              {formatDate(entry.period_start)} to{" "}
                              {formatDate(entry.period_end)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Generated by {entry.generated_by_name} ·{" "}
                              {formatDateTime(entry.generated_at)}
                            </p>
                          </div>
                          <div className="text-right text-sm text-slate-700">
                            <p>{formatMoney(entry.total_amount)}</p>
                            <p className="text-xs text-slate-500">
                              CGST {formatMoney(entry.total_cgst)} · SGST{" "}
                              {formatMoney(entry.total_sgst)} · IGST{" "}
                              {formatMoney(entry.total_igst)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {/* View as HTML in new tab */}
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `/api/compliance/gst-report/view/${entry.id}?format=html`,
                                "_blank",
                              )
                            }
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            View HTML
                          </button>

                          {/* Print as PDF */}
                          <button
                            type="button"
                            onClick={() =>
                              fetch(
                                `/api/compliance/gst-report/view/${entry.id}?format=html`,
                                { credentials: "include" },
                              )
                                .then((r) => r.text())
                                .then((html) => printReportHtml(html))
                                .catch(() =>
                                  setErrorMessage(
                                    "Unable to load report for printing.",
                                  ),
                                )
                            }
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Print PDF
                          </button>

                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                            Role {entry.generated_by_role}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div
                    ref={historySentinelRef}
                    aria-hidden="true"
                    className="h-1"
                  />
                  {hasMoreHistory ? (
                    <p className="text-center text-xs text-slate-500">
                      {isLoadingMore
                        ? "Loading more history..."
                        : "Scroll to load more history."}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  No GST export history yet. Generate your first report and it
                  will appear here automatically.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-slate-50"
        >
          Back to dashboard
          <X className="h-4 w-4 rotate-45" />
        </Link>
      </div>
    </div>
  );
}
