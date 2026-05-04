"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Trash2,
  AlertCircle,
  Loader,
  Search,
  Copy,
  ExternalLink,
  X,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReportActivityPanel } from "@/components/report-activity-panel";
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
  initialSelectedReportId?: string;
  initialSelectedDetails?: ReportDetailResponse | null;
  authContext: AuthContext;
  orgName: string;
  tenantUsers: import("@/lib/repositories/authRepository").UserRecord[];
  showReportBrowser?: boolean;
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

type ReportDetailItem = {
  id: string;
  receiptId: string;
  vendor: string | null;
  amount: number | string;
  category: string | null;
  receiptDate: string;
  uploadedAt: string;
  uploadedById?: string | null;
  uploadedByName?: string | null;
  uploadedByRole?: string | null;
  fileUrl?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  vendorGstin?: string | null;
};

type ReportDetailResponse = {
  report: ExpenseReport | null;
  items: ReportDetailItem[];
};

type ReportBrowserReport = ExpenseReport;

type CsvValidationResult = {
  reportsFound?: number;
  receiptsFound?: number;
  errors?: string[];
  [key: string]: unknown;
};

function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
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

function formatReportCsvValue(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toReportAmount(value: number | string | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ExpenseReportWorkspace({
  initialReports,
  initialReceiptsAvailable,
  initialHasMore,
  initialSelectedReportId,
  initialSelectedDetails,
  authContext,
  orgName,
  tenantUsers,
  showReportBrowser = true,
}: ExpenseReportWorkspaceProps) {
  const [reports, setReports] = useState<ExpenseReport[]>(initialReports);
  const [receiptsAvailable] = useState<ReceiptListItem[]>(
    initialReceiptsAvailable,
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    initialSelectedReportId ?? null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [isLoadingReportItems, setIsLoadingReportItems] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState("");
  const [newReportDescription, setNewReportDescription] = useState("");
  const [newReportPeriodStart, setNewReportPeriodStart] = useState("");
  const [newReportPeriodEnd, setNewReportPeriodEnd] = useState("");
  const [reportItems, setReportItems] = useState<string[]>(
    initialSelectedDetails?.items.map((item) => item.receiptId) ?? [],
  );
  const [reportItemsByReportId, setReportItemsByReportId] = useState<
    Record<string, string[]>
  >(
    initialSelectedDetails && initialSelectedReportId
      ? {
          [initialSelectedReportId]: initialSelectedDetails.items.map(
            (item) => item.receiptId,
          ),
        }
      : {},
  );
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptDateFrom, setReceiptDateFrom] = useState("");
  const [receiptDateTo, setReceiptDateTo] = useState("");
  const [receiptPickerItems, setReceiptPickerItems] = useState<
    ReceiptListItem[]
  >([]);
  const [receiptPickerOffset, setReceiptPickerOffset] = useState(0);
  const [receiptPickerHasMore, setReceiptPickerHasMore] = useState(false);
  const [isLoadingReceiptPicker, setIsLoadingReceiptPicker] = useState(false);
  const [isLoadingMoreReceipts, setIsLoadingMoreReceipts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const receiptPickerListRef = useRef<HTMLDivElement | null>(null);

  const [browseReports, setBrowseReports] =
    useState<ReportBrowserReport[]>(initialReports);
  const [browseStatus, setBrowseStatus] = useState<"all" | ReportStatus>("all");
  const [browseSearch, setBrowseSearch] = useState("");
  const [browseOffset, setBrowseOffset] = useState(initialReports.length);
  const [browseHasMore, setBrowseHasMore] = useState(initialHasMore);
  const [browseIsLoading, setBrowseIsLoading] = useState(false);
  const [browseIsLoadingMore, setBrowseIsLoadingMore] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseSelectedReportId, setBrowseSelectedReportId] = useState<
    string | null
  >(initialSelectedReportId ?? null);
  const [browseSelectedDetails, setBrowseSelectedDetails] =
    useState<ReportDetailResponse | null>(initialSelectedDetails ?? null);
  const [browseIsLoadingDetails, setBrowseIsLoadingDetails] = useState(false);
  const [browseDetailsCache, setBrowseDetailsCache] = useState<
    Record<string, ReportDetailResponse>
  >(
    initialSelectedDetails && initialSelectedReportId
      ? { [initialSelectedReportId]: initialSelectedDetails }
      : {},
  );
  const browseReportListRef = useRef<HTMLDivElement | null>(null);
  const [csvValidationResult, setCsvValidationResult] =
    useState<CsvValidationResult | null>(null);
  const [csvValidating, setCsvValidating] = useState(false);
  const isEmployee = authContext.role === "employee";

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId],
  );

  const browseSelectedReport = useMemo(
    () => browseReports.find((r) => r.id === browseSelectedReportId) || null,
    [browseReports, browseSelectedReportId],
  );
  const browseDetailReportId =
    browseSelectedDetails?.report?.id || browseSelectedReport?.id || "";

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
        const uniqueNext = nextItems.filter(
          (item) => !existingIds.has(item.id),
        );
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
          setError(
            err instanceof Error ? err.message : "Failed to load receipts",
          );
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
          periodStart: newReportPeriodStart || undefined,
          periodEnd: newReportPeriodEnd || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create report");
      }

      const newReport: ExpenseReport = await response.json();
      setReports((prev) => [newReport, ...prev]);
      setBrowseReports((prev) => [newReport, ...prev]);
      setSelectedReportId(newReport.id);
      setNewReportTitle("");
      setNewReportDescription("");
      setNewReportPeriodStart("");
      setNewReportPeriodEnd("");
      setReportItems([]);
      setReportItemsByReportId((prev) => ({
        ...prev,
        [newReport.id]: [],
      }));
      // Collapse the inline form and select the new report
      // (the useEffect watching browseSelectedReportId will load details)
      setShowCreateForm(false);
      setBrowseSelectedReportId(newReport.id);
      setSuccess("Report created successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create report");
    } finally {
      setIsCreating(false);
    }
  }, [newReportTitle, newReportDescription, newReportPeriodStart, newReportPeriodEnd]);

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

        // Add to the browse detail panel immediately so the UI updates
        const receipt = receiptsAvailable.find((r) => r.id === receiptId);
        if (receipt) {
          const newDetailItem = {
            id: receipt.id,
            receiptId: receipt.id,
            vendor: receipt.vendor,
            amount: receipt.amount,
            category: receipt.category,
            receiptDate: receipt.receiptDate,
            uploadedAt: receipt.uploadedAt,
            uploadedById: receipt.uploadedByUserId,
            uploadedByName: receipt.uploadedBy,
            uploadedByRole: receipt.uploadedByRole,
            fileUrl: receipt.fileUrl,
            fileName: receipt.fileName,
            mimeType: receipt.mimeType,
            vendorGstin: receipt.vendorGstin,
          };
          setBrowseSelectedDetails((prev) => {
            if (!prev) return prev;
            const alreadyIn = prev.items.some((i) => i.receiptId === receiptId);
            if (alreadyIn) return prev;
            return { ...prev, items: [...prev.items, newDetailItem] };
          });
          setBrowseDetailsCache((prev) => {
            const cached = prev[selectedReportId];
            if (!cached) return prev;
            const alreadyIn = cached.items.some((i) => i.receiptId === receiptId);
            if (alreadyIn) return prev;
            return {
              ...prev,
              [selectedReportId]: {
                ...cached,
                items: [...cached.items, newDetailItem],
              },
            };
          });
        }

        // Update report total
        if (receipt && selectedReport) {
          setReports((prev) =>
            prev.map((r) =>
              r.id === selectedReportId
                ? { ...r, totalAmount: r.totalAmount + receipt.amount }
                : r,
            ),
          );
          setBrowseReports((prev) =>
            prev.map((r) =>
              r.id === selectedReportId
                ? { ...r, totalAmount: r.totalAmount + receipt.amount }
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

        // Remove from the browse detail panel immediately so the UI updates
        setBrowseSelectedDetails((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.filter((item) => item.receiptId !== receiptId),
          };
        });
        setBrowseDetailsCache((prev) => {
          const cached = prev[selectedReportId];
          if (!cached) return prev;
          return {
            ...prev,
            [selectedReportId]: {
              ...cached,
              items: cached.items.filter((item) => item.receiptId !== receiptId),
            },
          };
        });

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
          setBrowseReports((prev) =>
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

      setReports((prev) =>
        prev.filter((report) => report.id !== selectedReport.id),
      );
      setBrowseReports((prev) =>
        prev.filter((report) => report.id !== selectedReport.id),
      );
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

  const fetchBrowseReportsPage = useCallback(
    async (offset: number, append: boolean) => {
      const query = new URLSearchParams({
        limit: String(25),
        offset: String(offset),
        status: browseStatus,
      });

      if (browseSearch.trim()) {
        query.set("search", browseSearch.trim());
      }

      const response = await fetch(`/api/reports?${query.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      const payload = (await response.json()) as {
        data?: ExpenseReport[];
        pagination?: { total: number; limit: number; offset: number };
        error?: string;
      };

      if (!response.ok || !payload.data || !payload.pagination) {
        throw new Error(payload.error || "Failed to load reports");
      }

      const nextItems = payload.data;
      setBrowseReports((current) => {
        if (!append) {
          return nextItems;
        }

        const existingIds = new Set(current.map((item) => item.id));
        const uniqueNext = nextItems.filter(
          (item) => !existingIds.has(item.id),
        );
        return [...current, ...uniqueNext];
      });
      setBrowseOffset(offset + nextItems.length);
      setBrowseHasMore(payload.pagination.total > offset + nextItems.length);
    },
    [browseSearch, browseStatus],
  );

  const loadBrowseReportDetails = useCallback(
    async (reportId: string) => {
      setBrowseSelectedReportId(reportId);
      setBrowseError(null);

      const cached = browseDetailsCache[reportId];
      if (cached) {
        setBrowseSelectedDetails(cached);
        return;
      }

      setBrowseIsLoadingDetails(true);
      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          method: "GET",
          credentials: "include",
        });
        const payload = (await response.json()) as {
          report?: ExpenseReport;
          items?: ReportDetailItem[];
          error?: string;
        };

        if (!response.ok || !payload.report) {
          throw new Error(payload.error || "Failed to load report details");
        }

        const details: ReportDetailResponse = {
          report: payload.report,
          items: payload.items ?? [],
        };

        setBrowseSelectedDetails(details);
        setBrowseDetailsCache((current) => ({
          ...current,
          [reportId]: details,
        }));
      } catch (detailError) {
        setBrowseSelectedDetails(null);
        setBrowseError(
          detailError instanceof Error
            ? detailError.message
            : "Failed to load report details",
        );
      } finally {
        setBrowseIsLoadingDetails(false);
      }
    },
    [browseDetailsCache],
  );

  const syncBrowseReport = useCallback((updatedReport: ExpenseReport) => {
    setReports((current) =>
      current.map((report) =>
        report.id === updatedReport.id ? updatedReport : report,
      ),
    );
    setBrowseReports((current) =>
      current.map((report) =>
        report.id === updatedReport.id ? updatedReport : report,
      ),
    );
    setBrowseSelectedDetails((current) =>
      current?.report?.id === updatedReport.id
        ? {
            ...current,
            report: updatedReport,
          }
        : current,
    );
    setBrowseDetailsCache((current) => ({
      ...current,
      [updatedReport.id]: {
        report: updatedReport,
        items: current[updatedReport.id]?.items ?? [],
      },
    }));
  }, []);

  const handleResubmitReport = useCallback(async () => {
    if (!selectedReport || selectedReport.status !== "rejected") return;

    setIsResubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${selectedReport.id}/resubmit`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resubmit report");
      }

      const updated: ExpenseReport = await response.json();
      syncBrowseReport(updated);
      setSuccess("Report moved back to draft — you can now edit and resubmit.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resubmit report");
    } finally {
      setIsResubmitting(false);
    }
  }, [selectedReport, syncBrowseReport]);

  const handleSubmitReport = useCallback(async () => {
    if (!selectedReportId) return;
    const submittingFromStatus = selectedReport?.status;

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
      syncBrowseReport(updated);
      setSuccess(
        submittingFromStatus === "info_requested"
          ? "Response submitted for approval"
          : "Report submitted for approval",
      );
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  }, [reportItems.length, selectedReport?.status, selectedReportId, syncBrowseReport]);

  const exportSelectedReportCsv = useCallback(() => {
    const report = browseSelectedDetails?.report;
    if (!report) return;

    const items = browseSelectedDetails?.items ?? [];
    const rows = [
      ["Spendly Report Export"],
      ["Workspace", orgName],
      ["Report ID", report.id],
      ["Report Title", report.title],
      ["Status", report.status],
      ["Total Amount", String(report.totalAmount)],
      ["Description", report.description ?? ""],
      [],
      [
        "Receipt ID",
        "Vendor",
        "Amount",
        "Category",
        "Receipt Date",
        "Uploaded By",
        "Uploader User ID",
        "Uploader Role",
      ],
      ...items.map((item) => [
        item.receiptId,
        item.vendor ?? "",
        String(toReportAmount(item.amount)),
        item.category ?? "",
        item.receiptDate,
        item.uploadedByName ?? "",
        item.uploadedById ?? "",
        item.uploadedByRole ?? "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => formatReportCsvValue(cell)).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [browseSelectedDetails, orgName]);

  const handleValidateCsvFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setCsvValidationResult(null);
    setCsvValidating(true);
    setBrowseError(null);
    try {
      const text = await file.text();
      const resp = await fetch(`/api/reports/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });

      const payload = await resp.json();
      if (!resp.ok) {
        setBrowseError(payload.error || "CSV validation failed");
      }
      setCsvValidationResult(payload);
    } catch (err) {
      setBrowseError(
        err instanceof Error ? err.message : "CSV validation failed",
      );
    } finally {
      setCsvValidating(false);
    }
  }, []);

  const printSelectedReportPdf = useCallback(() => {
    const report = browseSelectedDetails?.report;
    if (!report) return;

    const items = browseSelectedDetails?.items ?? [];
    const receiptDates = items
      .map((item) => item.receiptDate)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()));
    const derivedPeriodStart =
      receiptDates.length > 0
        ? receiptDates
            .reduce((earliest, current) =>
              current.getTime() < earliest.getTime() ? current : earliest,
            )
            .toISOString()
            .split("T")[0]
        : null;
    const derivedPeriodEnd =
      receiptDates.length > 0
        ? receiptDates
            .reduce((latest, current) =>
              current.getTime() > latest.getTime() ? current : latest,
            )
            .toISOString()
            .split("T")[0]
        : null;
    const periodStart = report.periodStart || derivedPeriodStart || "-";
    const periodEnd = report.periodEnd || derivedPeriodEnd || "-";
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

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${report.title} - Report</title>
          <style>
            @page { size: A4; margin: 18mm; }
            body { font-family: Arial, sans-serif; color: #0f172a; }
            .brand { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
            .brand h1 { margin: 0; font-size: 24px; }
            .brand p { margin: 4px 0 0; color: #475569; font-size: 12px; }
            .meta { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; margin-bottom: 18px; font-size: 12px; }
            .meta div { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
            table { width:100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f8fafc; }
            .status { font-weight: 700; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="brand">
            <div>
              <h1>Spendly</h1>
              <p>${orgName}</p>
            </div>
            <div style="text-align:right">
              <div class="status">${report.status}</div>
              <p>Generated ${new Date().toLocaleString("en-IN")}</p>
            </div>
          </div>

            <div class="meta">
            <div><strong>Report ID:</strong> ${report.id}</div>
            <div><strong>Total Amount:</strong> ${formatMoney(report.totalAmount)}</div>
            <div><strong>Title:</strong> ${report.title}</div>
            <div><strong>Period:</strong> ${periodStart + " to " + periodEnd}</div>
            <div><strong>Description:</strong> ${report.description || "-"}</div>
            <div><strong>Rejection Reason:</strong> ${report.rejectionReason || "-"}</div>
            <div><strong>Creator:</strong> ${report.creatorName || "-"}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Vendor</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Status</th>
                <th>Uploaded By</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (item) => `
                    <tr>
                      <td>${item.receiptId}</td>
                      <td>${item.vendor ?? ""}</td>
                      <td>${formatMoney(toReportAmount(item.amount))}</td>
                      <td>${item.category ?? ""}</td>
                      <td>${report.status}</td>
                      <td>${item.uploadedByName ?? ""} ${item.uploadedById ? `(${item.uploadedById})` : ""}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>

        </body>
      </html>
    `;

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

      setTimeout(() => {
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
  }, [browseSelectedDetails, orgName]);

  useEffect(() => {
    if (!showReportBrowser) {
      return;
    }

    let cancelled = false;

    const loadReports = async () => {
      setBrowseIsLoading(true);
      setBrowseError(null);
      try {
        await fetchBrowseReportsPage(0, false);
      } catch (err) {
        if (!cancelled) {
          setBrowseError(
            err instanceof Error ? err.message : "Failed to load reports",
          );
        }
      } finally {
        if (!cancelled) {
          setBrowseIsLoading(false);
        }
      }
    };

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [browseSearch, browseStatus, fetchBrowseReportsPage, showReportBrowser]);

  useEffect(() => {
    if (!browseSelectedReportId) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBrowseReportDetails(browseSelectedReportId);
  }, [browseSelectedReportId, loadBrowseReportDetails]);

  const handleBrowseReportsScroll = useCallback(() => {
    const container = browseReportListRef.current;
    if (
      !container ||
      browseIsLoadingMore ||
      browseIsLoading ||
      !browseHasMore
    ) {
      return;
    }

    const threshold = 120;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      threshold;

    if (nearBottom) {
      setBrowseIsLoadingMore(true);
      void fetchBrowseReportsPage(browseOffset, true)
        .catch((err) => {
          setBrowseError(
            err instanceof Error ? err.message : "Failed to load reports",
          );
        })
        .finally(() => {
          setBrowseIsLoadingMore(false);
        });
    }
  }, [
    browseHasMore,
    browseIsLoading,
    browseIsLoadingMore,
    browseOffset,
    fetchBrowseReportsPage,
  ]);

  const availableReceiptsCount = useMemo(
    () =>
      receiptsAvailable.filter(
        (r) => r.status === "verified" && !reportItems.includes(r.id),
      ).length,
    [receiptsAvailable, reportItems],
  );

  // Unified click handler: select a report in both the browse panel and the
  // draft-action handlers (which use selectedReportId / reportItems).
  const handleSelectUnifiedReport = useCallback(
    async (reportId: string) => {
      setSelectedReportId(reportId);
      setError(null);

      // Load browse details (handles its own cache)
      void loadBrowseReportDetails(reportId);

      // Load receipt IDs for draft actions (handles its own cache)
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
    [loadBrowseReportDetails, reportItemsByReportId],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
            {showReportBrowser ? "Expense Reports" : "Report details"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            {showReportBrowser
              ? "Group expenses into reports"
              : "Open report and manage its items"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {showReportBrowser
              ? "Organize your receipts, add notes, and prepare for approval."
              : "Manage this report, add receipts, export or print, and respond to workflow requests."}
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

        {/* BROWSE_PANEL_START */}
        <div
          className={cn(
            "grid gap-6",
            showReportBrowser ? "lg:grid-cols-[1fr_1.2fr]" : "",
          )}
        >
          {/* ── Left column: New Report button + inline form + search + list ── */}
          {showReportBrowser ? (
            <div className="space-y-4">
            {/* New Report button */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
                {isEmployee ? "My Reports" : "All Reports"}
              </p>
              <button
                type="button"
                onClick={() => setShowCreateForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                New Report
              </button>
            </div>

            {/* Inline create form */}
            {showCreateForm && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">
                  Create a new report
                </p>
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
                    className="text-sm h-20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Period Start
                    </label>
                    <Input
                      type="date"
                      value={newReportPeriodStart}
                      onChange={(e) => setNewReportPeriodStart(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Period End
                    </label>
                    <Input
                      type="date"
                      value={newReportPeriodEnd}
                      onChange={(e) => setNewReportPeriodEnd(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreateReport()}
                    disabled={isCreating}
                    className="flex-1 rounded-lg bg-slate-950 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:bg-slate-300"
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
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewReportTitle("");
                      setNewReportDescription("");
                      setNewReportPeriodStart("");
                      setNewReportPeriodEnd("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Search + status filter */}
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={browseSearch}
                  onChange={(event) => {
                    setBrowseSearch(event.target.value);
                    setBrowseOffset(0);
                    setBrowseReports([]);
                    setBrowseSelectedReportId(null);
                    setBrowseSelectedDetails(null);
                    setBrowseHasMore(true);
                  }}
                  placeholder="Search by report name or ID"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700"
                />
              </div>
              <select
                value={browseStatus}
                onChange={(event) => {
                  setBrowseStatus(event.target.value as "all" | ReportStatus);
                  setBrowseOffset(0);
                  setBrowseReports([]);
                  setBrowseSelectedReportId(null);
                  setBrowseSelectedDetails(null);
                  setBrowseHasMore(true);
                }}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2"
              >
                {statusOptions.map((opt) => (
                  <option key={`browse-${opt.value}`} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Scrollable report list */}
            <div
              ref={browseReportListRef}
              onScroll={handleBrowseReportsScroll}
              className="max-h-[68vh] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              {browseIsLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Loading reports...
                </p>
              ) : browseError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {browseError}
                </p>
              ) : browseReports.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No reports found.
                </p>
              ) : (
                browseReports.map((report, index) => (
                  <button
                    key={report.id || `browse-report-${index}-${report.title}`}
                    type="button"
                    onClick={() => {
                      void handleSelectUnifiedReport(report.id);
                    }}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      browseSelectedReportId === report.id
                        ? "border-slate-900 bg-slate-950 text-white"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{report.title}</p>
                        <p
                          className={cn(
                            "mt-1 text-xs",
                            browseSelectedReportId === report.id
                              ? "text-slate-300"
                              : "text-slate-500",
                          )}
                        >
                          {formatMoney(report.totalAmount)} · Created{" "}
                          {formatDateTime(report.createdAt)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-1 text-[11px] font-medium",
                          getStatusBadgeColor(report.status),
                          browseSelectedReportId === report.id
                            ? "bg-white/10 text-white"
                            : "",
                        )}
                      >
                        {report.status}
                      </span>
                    </div>
                  </button>
                ))
              )}

              {browseIsLoadingMore ? (
                <p className="py-2 text-center text-xs text-slate-500">
                  Loading more reports...
                </p>
              ) : null}
            </div>
          </div>
          ) : null}

          {/* ── Right column: detail panel ── */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-slate-100">
              <div>
                <CardTitle className="text-lg text-slate-950">
                  {browseSelectedDetails?.report?.title ||
                    browseSelectedReport?.title ||
                    "Report details"}
                </CardTitle>
                <CardDescription>
                  {browseSelectedDetails?.report?.status ||
                    browseSelectedReport?.status ||
                    "Select a report to view its items, export, and print."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {!showReportBrowser ? (
                  <a
                    href="/workspace/reports"
                    className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Back to reports
                  </a>
                ) : null}
                {/* Delete draft button — shown in header for draft reports */}
                {browseSelectedDetails?.report?.status === "draft" && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteDraftReport()}
                    disabled={isDeletingReport}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeletingReport ? "Deleting..." : "Delete draft"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={printSelectedReportPdf}
                  disabled={!browseSelectedDetails?.report}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Print PDF
                </button>
                <button
                  type="button"
                  onClick={exportSelectedReportCsv}
                  disabled={!browseSelectedDetails?.report}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* CSV import section */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  Import report CSV
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) =>
                      handleValidateCsvFile(e.target.files?.[0] ?? null)
                    }
                    className="text-sm"
                  />
                  {csvValidating ? (
                    <span className="text-sm text-slate-500">
                      Validating...
                    </span>
                  ) : null}
                </div>

                {csvValidationResult ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-medium">Validation summary</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Reports found: {csvValidationResult.reportsFound ?? 0} ·
                      Receipts: {csvValidationResult.receiptsFound ?? 0}
                    </p>
                    {csvValidationResult.errors &&
                    csvValidationResult.errors.length > 0 ? (
                      <div className="mt-2 text-xs text-rose-700">
                        <p className="font-medium">Errors</p>
                        <ul className="list-disc pl-5 mt-1">
                          {csvValidationResult.errors
                            .slice(0, 10)
                            .map((err: string, idx: number) => (
                              <li key={idx}>{err}</li>
                            ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-700">
                        No validation errors found.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              {browseIsLoadingDetails ? (
                <p className="text-sm text-slate-500">
                  Loading report details...
                </p>
              ) : browseSelectedDetails?.report ? (
                <>
                  {/* Metadata grid */}
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Total
                      </p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">
                        {formatMoney(
                          browseSelectedDetails.report.totalAmount,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Status
                      </p>
                      <p
                        className={cn(
                          "mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium",
                          getStatusBadgeColor(
                            browseSelectedDetails.report.status,
                          ),
                        )}
                      >
                        {browseSelectedDetails.report.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Created
                      </p>
                      <p className="mt-1">
                        {formatDateTime(
                          browseSelectedDetails.report.createdAt,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Creator
                      </p>
                      <p className="mt-1">
                        {browseSelectedDetails.report.creatorName ||
                          "Unknown"}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Report ID
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="rounded-md bg-white px-2 py-1 text-xs text-slate-700">
                          {browseDetailReportId}
                        </code>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!browseDetailReportId) return;
                            await navigator.clipboard.writeText(
                              browseDetailReportId,
                            );
                            setSuccess("Report ID copied");
                            window.setTimeout(() => setSuccess(null), 2000);
                          }}
                          disabled={!browseDetailReportId}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Rejection banner */}
                  {browseSelectedDetails.report.status === "rejected" && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                      <div className="flex gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-800">
                            Report rejected
                          </p>
                          {browseSelectedDetails.report.rejectionReason && (
                            <p className="mt-1 text-sm text-red-700">
                              {browseSelectedDetails.report.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>
                      {(isEmployee || browseSelectedDetails.report.userId === authContext.userId) && (
                        <button
                          type="button"
                          onClick={() => void handleResubmitReport()}
                          disabled={isResubmitting}
                          className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                        >
                          {isResubmitting
                            ? "Moving to draft..."
                            : "Resubmit (move back to draft)"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Draft / info_requested actions — visible to report owner or admin */}
                  {(() => {
                    const r = browseSelectedDetails.report;
                    const isOwner = r.userId === authContext.userId;
                    const canEdit =
                      authContext.role === "admin" ||
                      isOwner ||
                      (authContext.role === "manager" && isOwner);
                    return (
                      (r.status === "draft" && canEdit) ||
                      (r.status === "info_requested" && (isEmployee || isOwner))
                    );
                  })() && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Receipts in this report
                      </p>

                      {isLoadingReportItems ? (
                        <p className="text-sm text-slate-500">
                          Loading receipts...
                        </p>
                      ) : browseSelectedDetails.items.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No receipts added yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {browseSelectedDetails.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {item.vendor ?? "Unknown vendor"}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {formatMoney(toReportAmount(item.amount))} ·{" "}
                                  {item.category ?? "uncategorized"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleRemoveReceiptFromReport(
                                    item.receiptId,
                                  )
                                }
                                className="shrink-0 text-xs text-rose-600 hover:text-rose-700 font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleOpenReceiptPicker}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Search className="h-4 w-4" />
                        Add receipts
                      </button>
                      <p className="text-xs text-slate-500">
                        {availableReceiptsCount > 0
                          ? `${availableReceiptsCount} verified receipts are currently available.`
                          : "No more verified receipts are currently available."}
                      </p>

                      <button
                        type="button"
                        onClick={() => void handleSubmitReport()}
                        disabled={isSubmitting || reportItems.length === 0}
                        className="w-full rounded-lg bg-slate-950 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:bg-slate-300"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <Loader className="h-4 w-4 animate-spin" />
                            Submitting...
                          </span>
                        ) : browseSelectedDetails.report.status ===
                          "info_requested" ? (
                          "Submit response"
                        ) : (
                          "Submit for Approval"
                        )}
                      </button>
                    </div>
                  )}

                  {/* Read-only items list (for non-draft statuses) */}
                  {browseSelectedDetails.report.status !== "draft" &&
                    !(
                      browseSelectedDetails.report.status ===
                        "info_requested" && isEmployee
                    ) && (
                      <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
                        {browseSelectedDetails.items.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                            No items found for this report.
                          </p>
                        ) : (
                          browseSelectedDetails.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-xl border border-slate-200 p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {item.vendor ?? "Unknown vendor"}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    ₹{formatMoney(toReportAmount(item.amount))}{" "}
                                    · {item.category ?? "uncategorized"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Receipt: {item.receiptId} · Date:{" "}
                                    {item.receiptDate}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    Uploaded by:{" "}
                                    {item.uploadedByName ?? "Unknown"} (
                                    {item.uploadedByRole ?? "unknown"}) · ID:{" "}
                                    {item.uploadedById ?? "—"}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {item.fileUrl ? (
                                    <a
                                      href={item.fileUrl}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                      className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                                    >
                                      Open receipt
                                    </a>
                                  ) : (
                                    <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-500">
                                      Receipt unavailable
                                    </span>
                                  )}
                                  <div className="text-xs text-slate-500">
                                    {item.mimeType ?? ""}{" "}
                                    {item.vendorGstin
                                      ? `· GSTIN ${item.vendorGstin}`
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                  <ReportActivityPanel
                    report={browseSelectedDetails.report}
                    reportItemsCount={browseSelectedDetails.items.length}
                    authContext={authContext}
                    tenantUsers={tenantUsers}
                    onReportUpdated={syncBrowseReport}
                  />
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  Select a report from the left to see details, export CSV, or
                  print as PDF.
                </p>
              )}
            </CardContent>
          </Card>
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
                  Filter by date range, check receipt notes, and add receipts to
                  this report.
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
                              {receipt.vendor} •{" "}
                              {formatMoney(receipt.amount, receipt.currency)}
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
