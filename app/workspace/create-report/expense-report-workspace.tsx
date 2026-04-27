"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Trash2,
  AlertCircle,
  Loader,
  Search,
  ExternalLink,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ExpenseReport,
  ReportStatus,
} from "@/lib/repositories/reportRepository";
import type { ReceiptListItem } from "@/lib/repositories/receiptRepository";

interface AuthContext {
  tenantId: string;
  userId: string;
  role: "employee" | "manager" | "admin";
}

interface ExpenseReportWorkspaceProps {
  initialReports: ExpenseReport[];
  initialReceiptsAvailable: ReceiptListItem[];
  initialHasMore: boolean;
  authContext: AuthContext;
}

const statusOptions: Array<{ label: string; value: "all" | ReportStatus }> = [
  { label: "All status", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Submitted", value: "submitted" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

const RECEIPT_PAGE_SIZE = 25;

type ReceiptListApiResponse = {
  ok: boolean;
  data?: {
    receipts: ReceiptListItem[];
    pagination: {
      offset: number;
      total: number;
      hasMore: boolean;
    };
  };
  error?: {
    message?: string;
  };
};

function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getStatusBadgeColor(status: ReportStatus) {
  const colors: Record<ReportStatus, string> = {
    draft: "bg-gray-100 text-gray-800",
    submitted: "bg-blue-100 text-blue-800",
    info_requested: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    paid: "bg-purple-100 text-purple-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function ExpenseReportWorkspace({
  initialReports,
  initialReceiptsAvailable,
}: ExpenseReportWorkspaceProps) {
  const [reports, setReports] = useState<ExpenseReport[]>(initialReports);
  const [receiptsAvailable] = useState<ReceiptListItem[]>(
    initialReceiptsAvailable,
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"all" | ReportStatus>(
    "all",
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [isLoadingReportItems, setIsLoadingReportItems] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState("");
  const [newReportDescription, setNewReportDescription] = useState("");
  const [reportItems, setReportItems] = useState<string[]>([]);
  const [reportItemsByReportId, setReportItemsByReportId] = useState<
    Record<string, string[]>
  >({});
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptDateFrom, setReceiptDateFrom] = useState("");
  const [receiptDateTo, setReceiptDateTo] = useState("");
  const [receiptPickerItems, setReceiptPickerItems] = useState<ReceiptListItem[]>(
    [],
  );
  const [receiptPickerOffset, setReceiptPickerOffset] = useState(0);
  const [receiptPickerHasMore, setReceiptPickerHasMore] = useState(false);
  const [isLoadingReceiptPicker, setIsLoadingReceiptPicker] = useState(false);
  const [isLoadingMoreReceipts, setIsLoadingMoreReceipts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const receiptPickerListRef = useRef<HTMLDivElement | null>(null);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId],
  );

  const filteredReports = useMemo(
    () =>
      selectedStatus === "all"
        ? reports
        : reports.filter((r) => r.status === selectedStatus),
    [reports, selectedStatus],
  );

  const handleSelectReport = useCallback(
    async (reportId: string) => {
      setSelectedReportId(reportId);
      setError(null);

      const cachedItems = reportItemsByReportId[reportId];
      if (cachedItems) {
        setReportItems(cachedItems);
        return;
      }

      setIsLoadingReportItems(true);

      try {
        const response = await fetch(`/api/reports/${reportId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to load report details");
        }

        const data = (await response.json()) as {
          items?: Array<{ receiptId: string }>;
        };

        const receiptIds = (data.items || []).map((item) => item.receiptId);

        setReportItems(receiptIds);
        setReportItemsByReportId((prev) => ({
          ...prev,
          [reportId]: receiptIds,
        }));
      } catch (err) {
        setReportItems([]);
        setError(
          err instanceof Error ? err.message : "Failed to load report items",
        );
      } finally {
        setIsLoadingReportItems(false);
      }
    },
    [reportItemsByReportId],
  );

  const handleOpenCreateNew = useCallback(() => {
    setSelectedReportId(null);
    setReportItems([]);
    setError(null);
  }, []);

  const fetchReceiptPickerPage = useCallback(
    async (offset: number, append: boolean) => {
      const query = new URLSearchParams({
        status: "verified",
        limit: String(RECEIPT_PAGE_SIZE),
        offset: String(offset),
      });

      if (receiptSearch.trim()) {
        query.set("search", receiptSearch.trim());
      }

      if (receiptDateFrom) {
        query.set("dateFrom", receiptDateFrom);
      }

      if (receiptDateTo) {
        query.set("dateTo", receiptDateTo);
      }

      const response = await fetch(`/api/receipts?${query.toString()}`);
      const payload = (await response.json()) as ReceiptListApiResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message || "Failed to load receipts");
      }

      const nextItems = payload.data.receipts;

      setReceiptPickerItems((prev) => {
        if (!append) {
          return nextItems;
        }

        const existingIds = new Set(prev.map((item) => item.id));
        const uniqueNext = nextItems.filter((item) => !existingIds.has(item.id));
        return [...prev, ...uniqueNext];
      });
      setReceiptPickerOffset(offset + nextItems.length);
      setReceiptPickerHasMore(payload.data.pagination.hasMore);
    },
    [receiptDateFrom, receiptDateTo, receiptSearch],
  );

  const loadMoreReceiptPickerItems = useCallback(async () => {
    if (
      !isReceiptDialogOpen ||
      isLoadingMoreReceipts ||
      isLoadingReceiptPicker ||
      !receiptPickerHasMore
    ) {
      return;
    }

    setIsLoadingMoreReceipts(true);
    try {
      await fetchReceiptPickerPage(receiptPickerOffset, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load receipts");
    } finally {
      setIsLoadingMoreReceipts(false);
    }
  }, [
    fetchReceiptPickerPage,
    isLoadingMoreReceipts,
    isLoadingReceiptPicker,
    isReceiptDialogOpen,
    receiptPickerHasMore,
    receiptPickerOffset,
  ]);

  const handleReceiptPickerScroll = useCallback(() => {
    const container = receiptPickerListRef.current;
    if (!container) {
      return;
    }

    const threshold = 120;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      threshold;

    if (nearBottom) {
      void loadMoreReceiptPickerItems();
    }
  }, [loadMoreReceiptPickerItems]);

  useEffect(() => {
    if (!isReceiptDialogOpen) {
      return;
    }

    let cancelled = false;

    const loadInitial = async () => {
      setIsLoadingReceiptPicker(true);
      try {
        await fetchReceiptPickerPage(0, false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load receipts");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingReceiptPicker(false);
        }
      }
    };

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [fetchReceiptPickerPage, isReceiptDialogOpen]);

  const handleOpenReceiptPicker = useCallback(() => {
    setError(null);
    setIsReceiptDialogOpen(true);
  }, []);

  const handleCloseReceiptPicker = useCallback(() => {
    setIsReceiptDialogOpen(false);
  }, []);

  const handleCreateReport = useCallback(async () => {
    if (!newReportTitle.trim()) {
      setError("Report title is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newReportTitle.trim(),
          description: newReportDescription.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create report");
      }

      const newReport: ExpenseReport = await response.json();
      setReports((prev) => [newReport, ...prev]);
      setSelectedReportId(newReport.id);
      setNewReportTitle("");
      setNewReportDescription("");
      setReportItems([]);
      setReportItemsByReportId((prev) => ({
        ...prev,
        [newReport.id]: [],
      }));
      setSuccess("Report created successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create report");
    } finally {
      setIsCreating(false);
    }
  }, [newReportTitle, newReportDescription]);

  const handleAddReceiptToReport = useCallback(
    async (receiptId: string) => {
      if (!selectedReportId) return;

      setError(null);
      try {
        const response = await fetch(`/api/reports/${selectedReportId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiptId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to add receipt");
        }

        setReportItems((prev) =>
          prev.includes(receiptId) ? prev : [...prev, receiptId],
        );
        setReportItemsByReportId((prev) => ({
          ...prev,
          [selectedReportId]: (prev[selectedReportId] || []).includes(receiptId)
            ? prev[selectedReportId] || []
            : [...(prev[selectedReportId] || []), receiptId],
        }));

        // Update report total
        const receipt = receiptsAvailable.find((r) => r.id === receiptId);
        if (receipt && selectedReport) {
          setReports((prev) =>
            prev.map((r) =>
              r.id === selectedReportId
                ? {
                    ...r,
                    totalAmount: r.totalAmount + receipt.amount,
                  }
                : r,
            ),
          );
        }

        setSuccess("Receipt added to report");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add receipt");
      }
    },
    [selectedReportId, selectedReport, receiptsAvailable],
  );

  const handleRemoveReceiptFromReport = useCallback(
    async (receiptId: string) => {
      if (!selectedReportId) return;

      setError(null);
      try {
        const response = await fetch(
          `/api/reports/${selectedReportId}/items/${receiptId}`,
          {
            method: "DELETE",
          },
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to remove receipt");
        }

        setReportItems((prev) => prev.filter((id) => id !== receiptId));
        setReportItemsByReportId((prev) => ({
          ...prev,
          [selectedReportId]: (prev[selectedReportId] || []).filter(
            (id) => id !== receiptId,
          ),
        }));

        // Update report total
        const receipt = receiptsAvailable.find((r) => r.id === receiptId);
        if (receipt && selectedReport) {
          setReports((prev) =>
            prev.map((r) =>
              r.id === selectedReportId
                ? {
                    ...r,
                    totalAmount: Math.max(0, r.totalAmount - receipt.amount),
                  }
                : r,
            ),
          );
        }

        setSuccess("Receipt removed from report");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to remove receipt",
        );
      }
    },
    [selectedReportId, selectedReport, receiptsAvailable],
  );

  const handleSubmitReport = useCallback(async () => {
    if (!selectedReportId) return;

    if (reportItems.length === 0) {
      setError("Report must have at least one receipt");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${selectedReportId}/submit`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit report");
      }

      const updated: ExpenseReport = await response.json();
      setReports((prev) =>
        prev.map((r) => (r.id === selectedReportId ? updated : r)),
      );
      setSuccess("Report submitted for approval");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedReportId, reportItems.length]);

  const handleDeleteDraftReport = useCallback(async () => {
    if (!selectedReport || selectedReport.status !== "draft") {
      return;
    }

    const confirmed = window.confirm(
      "Delete this draft report? This action cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingReport(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${selectedReport.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete report");
      }

      setReports((prev) => prev.filter((report) => report.id !== selectedReport.id));
      setReportItemsByReportId((prev) => {
        const next = { ...prev };
        delete next[selectedReport.id];
        return next;
      });
      setSelectedReportId(null);
      setReportItems([]);
      setSuccess("Draft report deleted");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete report");
    } finally {
      setIsDeletingReport(false);
    }
  }, [selectedReport]);

  const reportReceiptItems = useMemo(
    () => receiptsAvailable.filter((r) => reportItems.includes(r.id)),
    [receiptsAvailable, reportItems],
  );

  const availableReceiptsCount = useMemo(
    () =>
      receiptsAvailable.filter(
        (r) => r.status === "verified" && !reportItems.includes(r.id),
      ).length,
    [receiptsAvailable, reportItems],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
            Expense Reports
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Group expenses into reports
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Organize your receipts, add notes, and prepare for approval.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 flex gap-3">
            <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
          {/* Left: Report List */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">
                Your Reports
              </h2>

              <div className="flex gap-2 mb-4">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-2"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredReports.length === 0 ? (
                  <p className="text-sm text-slate-500 p-3">No reports found</p>
                ) : (
                  filteredReports.map((report) => (
                    <button
                      key={report.id}
                      onClick={() => {
                        void handleSelectReport(report.id);
                      }}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        selectedReportId === report.id
                          ? "border-slate-300 bg-slate-100"
                          : "border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <div className="font-medium text-sm text-slate-900">
                        {report.title}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        {formatMoney(report.totalAmount)}
                      </div>
                      <div
                        className={cn(
                          "text-xs mt-2 inline-block px-2 py-1 rounded",
                          getStatusBadgeColor(report.status),
                        )}
                      >
                        {report.status}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Report Details or Create Form */}
          <div className="space-y-4">
            {selectedReport ? (
              <Card className="border-slate-200">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-lg">
                    {selectedReport.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedReport.status === "draft" ? (
                      <button
                        type="button"
                        onClick={handleDeleteDraftReport}
                        disabled={isDeletingReport}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeletingReport ? "Deleting..." : "Delete draft"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleOpenCreateNew}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      Create new report
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedReport.description && (
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1">
                        Description
                      </p>
                      <p className="text-sm text-slate-700">
                        {selectedReport.description}
                      </p>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      Items ({reportReceiptItems.length})
                    </p>
                    {isLoadingReportItems ? (
                      <p className="text-sm text-slate-500">
                        Loading report items...
                      </p>
                    ) : null}
                    {reportReceiptItems.length === 0 ? (
                      <p className="text-sm text-slate-500">No items added</p>
                    ) : (
                      <div className="space-y-2">
                        {reportReceiptItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-start p-2 rounded-lg bg-slate-50 border border-slate-100"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-900">
                                {item.vendor}
                              </p>
                              <p className="text-xs text-slate-600">
                                {item.category}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-slate-900">
                                {formatMoney(item.amount)}
                              </p>
                              {selectedReport.status === "draft" && (
                                <button
                                  onClick={() =>
                                    handleRemoveReceiptFromReport(item.id)
                                  }
                                  className="mt-1 text-xs text-red-600 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-sm font-medium text-slate-900">
                        Total
                      </p>
                      <p className="text-lg font-semibold text-slate-950">
                        {formatMoney(
                          reportReceiptItems.reduce(
                            (sum, item) => sum + item.amount,
                            0,
                          ),
                        )}
                      </p>
                    </div>

                    {selectedReport.status === "draft" && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-600 mb-2">
                          Add receipts
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenReceiptPicker}
                          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Search className="h-4 w-4" />
                          Browse and add receipts
                        </button>
                        <p className="text-xs text-slate-500">
                          {availableReceiptsCount > 0
                            ? `${availableReceiptsCount} verified receipts are currently available.`
                            : "No more verified receipts are currently available."}
                        </p>
                      </div>
                    )}

                    {selectedReport.status === "draft" && (
                      <button
                        onClick={handleSubmitReport}
                        disabled={
                          isSubmitting || reportReceiptItems.length === 0
                        }
                        className="mt-4 w-full rounded-lg bg-slate-950 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:bg-slate-300"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader className="h-4 w-4 animate-spin" />
                            Submitting...
                          </span>
                        ) : (
                          "Submit for Approval"
                        )}
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Create New Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Report Title *
                    </label>
                    <Input
                      value={newReportTitle}
                      onChange={(e) => setNewReportTitle(e.target.value)}
                      placeholder="e.g., Mumbai Client Trip - April"
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Description
                    </label>
                    <Textarea
                      value={newReportDescription}
                      onChange={(e) => setNewReportDescription(e.target.value)}
                      placeholder="Add any notes or context..."
                      className="text-sm h-24"
                    />
                  </div>

                  <button
                    onClick={handleCreateReport}
                    disabled={isCreating}
                    className="w-full rounded-lg bg-slate-950 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:bg-slate-300"
                  >
                    {isCreating ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader className="h-4 w-4 animate-spin" />
                        Creating...
                      </span>
                    ) : (
                      "Create Report"
                    )}
                  </button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>

      {isReceiptDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Add Verified Receipts
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Filter by date range, check receipt notes, and add receipts to this report.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseReceiptPicker}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50"
                aria-label="Close receipt picker"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <Input
                  value={receiptSearch}
                  onChange={(event) => setReceiptSearch(event.target.value)}
                  placeholder="Search by receipt number, vendor, or amount"
                />
                <Input
                  type="date"
                  value={receiptDateFrom}
                  onChange={(event) => setReceiptDateFrom(event.target.value)}
                />
                <Input
                  type="date"
                  value={receiptDateTo}
                  onChange={(event) => setReceiptDateTo(event.target.value)}
                />
              </div>

              <div
                ref={receiptPickerListRef}
                onScroll={handleReceiptPickerScroll}
                className="max-h-104 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3"
              >
                {isLoadingReceiptPicker ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    Loading receipts...
                  </p>
                ) : receiptPickerItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No verified receipts found for this filter.
                  </p>
                ) : (
                  receiptPickerItems.map((receipt) => {
                    const alreadyAdded = reportItems.includes(receipt.id);
                    return (
                      <div
                        key={receipt.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {receipt.vendor} • {formatMoney(receipt.amount, receipt.currency)}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {receipt.receiptId} • Date: {receipt.receiptDate} • Category: {receipt.category}
                            </p>
                            <p className="mt-2 text-sm text-slate-700">
                              {receipt.description || "No note provided."}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {receipt.fileUrl ? (
                              <a
                                href={receipt.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open
                              </a>
                            ) : null}
                            <button
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => {
                                void handleAddReceiptToReport(receipt.id);
                              }}
                              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:bg-slate-300"
                            >
                              {alreadyAdded ? "Added" : "Add"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {isLoadingMoreReceipts ? (
                  <p className="py-2 text-center text-xs text-slate-500">
                    Loading more receipts...
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
