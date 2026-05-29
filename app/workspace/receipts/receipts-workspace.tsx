"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  CalendarDays,
  Eye,
  ExternalLink,
  Filter,
  MessageSquare,
  Search,
  Send,
  User,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ReceiptListItem } from "@/lib/repositories/receiptRepository";

type ReceiptStatus = ReceiptListItem["status"];

const statusOptions: Array<{ label: string; value: "all" | ReceiptStatus }> = [
  { label: "All status", value: "all" },
  { label: "Processing", value: "processing" },
  { label: "Draft", value: "draft" },
  { label: "Verified", value: "verified" },
  { label: "Needs review", value: "needs_review" },
  { label: "Archived", value: "archived" },
];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let index = 0;
  let value = bytes;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[index]}`;
}

function mergeUniqueReceipts(
  current: ReceiptListItem[],
  incoming: ReceiptListItem[],
): ReceiptListItem[] {
  const seen = new Set(current.map((item) => item.id));
  const merged = [...current];

  for (const item of incoming) {
    if (seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

type ReceiptsApiResponse = {
  ok: boolean;
  data?: {
    receipts: ReceiptListItem[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  };
  error?: {
    message?: string;
  };
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export function ReceiptsWorkspace({
  receipts,
  canReview,
  initialPageSize,
  initialHasMore,
  initialDateFrom,
  initialDateTo,
  showReceiptBrowser = true,
  initialSelectedReceiptId,
  initialSelectedDetails,
}: {
  receipts: ReceiptListItem[];
  canReview: boolean;
  initialPageSize: number;
  initialHasMore: boolean;
  initialDateFrom: string;
  initialDateTo: string;
  showReceiptBrowser?: boolean;
  initialSelectedReceiptId?: string;
  initialSelectedDetails?: ReceiptListItem | null;
}) {
  const [receiptRows, setReceiptRows] = useState(receipts);
  const [allCategories, setAllCategories] = useState<string[]>(() => [
    "all",
    ...new Set(receipts.map((r) => r.category).filter(Boolean)),
  ]);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [showAll, setShowAll] = useState(true);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [draftDateFrom, setDraftDateFrom] = useState(initialDateFrom);
  const [draftDateTo, setDraftDateTo] = useState(initialDateTo);
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReceiptStatus>(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedReceiptId, setSelectedReceiptId] = useState(
    initialSelectedReceiptId ?? receipts[0]?.receiptId ?? "",
  );
  const [reviewState, setReviewState] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const [commentDraft, setCommentDraft] = useState("");
  const [commentState, setCommentState] = useState<{
    kind: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const latestFilterRequestRef = useRef(0);
  const activeFilterControllerRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);
  const lastFilterKeyRef = useRef<string | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const dialogRangeError = useMemo(() => {
    if (!isDateDialogOpen) {
      return null;
    }

    if (draftDateTo > todayIso) {
      return "End date cannot be later than today.";
    }

    if (draftDateFrom > draftDateTo) {
      return "From date cannot be later than To date.";
    }

    return null;
  }, [draftDateFrom, draftDateTo, isDateDialogOpen, todayIso]);

  const categories = allCategories;

  const filteredReceipts = receiptRows;

  const selectedReceipt =
    receiptRows.find((row) => row.receiptId === selectedReceiptId) ??
    receiptRows[0] ??
    null;

  const buildFilterParams = useCallback(
    (overrides?: { limit?: number; offset?: number }) => {
      const params = new URLSearchParams({
        limit: String(overrides?.limit ?? pageSize),
        offset: String(overrides?.offset ?? 0),
      });

      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        params.set("search", normalizedQuery);
      }

      if (showAll) {
        params.set("all", "true");
      } else {
        params.set("dateFrom", dateFrom);
        params.set("dateTo", dateTo);
      }

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      if (categoryFilter !== "all") {
        params.set("category", categoryFilter);
      }

      return params;
    },
    [categoryFilter, dateFrom, dateTo, pageSize, query, showAll, statusFilter],
  );

  const fetchReceiptPage = useCallback(
    async ({ offset, replace }: { offset: number; replace: boolean }) => {
      if (replace) {
        activeFilterControllerRef.current?.abort();
      }

      const controller = new AbortController();
      activeFilterControllerRef.current = controller;
      const requestId = latestFilterRequestRef.current + 1;
      latestFilterRequestRef.current = requestId;

      if (replace) {
        setIsRefreshing(true);
        setListError(null);
        setSelectedReceiptId("");
        setReceiptRows([]);
        setCommentDraft("");
        setCommentState({ kind: "idle", message: "" });
        setReviewState({ kind: "idle", message: "" });
      } else {
        setIsLoadingMore(true);
        setListError(null);
      }

      try {
        const params = buildFilterParams({ offset });

        const response = await fetch(`/api/receipts?${params.toString()}`, {
          method: "GET",
          credentials: "include",
          signal: controller.signal,
        });

        const data = (await response.json()) as ReceiptsApiResponse;

        if (!response.ok || !data.ok || !data.data) {
          throw new Error(data.error?.message ?? "Failed to fetch receipts.");
        }

        if (requestId !== latestFilterRequestRef.current) {
          return;
        }

        setHasMore(data.data.pagination.hasMore);
        setReceiptRows((current) =>
          replace
            ? data.data!.receipts
            : mergeUniqueReceipts(current, data.data!.receipts),
        );

        // Keep the category dropdown populated with all known categories.
        // Only update when no category filter is active so we capture the full set.
        if (replace && categoryFilter === "all") {
          setAllCategories((prev) => {
            const incoming = data.data!.receipts
              .map((r) => r.category)
              .filter(Boolean);
            const merged = new Set([...prev.filter((c) => c !== "all"), ...incoming]);
            return ["all", ...merged];
          });
        }

        if (data.data.receipts.length > 0) {
          setSelectedReceiptId(
            (current) => current || data.data!.receipts[0]!.receiptId,
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        if (requestId !== latestFilterRequestRef.current) {
          return;
        }

        setListError(
          error instanceof Error ? error.message : "Failed to fetch receipts.",
        );
        setHasMore(false);
        if (replace) {
          setReceiptRows([]);
        }
      } finally {
        if (requestId !== latestFilterRequestRef.current) {
          return;
        }

        if (replace) {
          setIsRefreshing(false);
          if (listContainerRef.current) {
            listContainerRef.current.scrollTop = 0;
          }
        } else {
          setIsLoadingMore(false);
        }
      }
    },
    [buildFilterParams, categoryFilter],
  );

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isRefreshing || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    setListError(null);

    try {
      await fetchReceiptPage({ offset: receiptRows.length, replace: false });
    } catch (error) {
      setListError(
        error instanceof Error
          ? error.message
          : "Could not load more receipts.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    fetchReceiptPage,
    hasMore,
    isLoadingMore,
    isRefreshing,
    receiptRows.length,
  ]);

  const onListScroll = useCallback(() => {
    const container = listContainerRef.current;
    if (!container) {
      return;
    }

    const threshold = 120;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      threshold;

    if (nearBottom) {
      void loadMore();
    }
  }, [loadMore]);

  const onReview = async (decision: "approve" | "reject") => {
    const canApprove =
      selectedReceipt?.status === "needs_review" ||
      selectedReceipt?.status === "draft";
    const canReject = selectedReceipt?.status === "needs_review";

    if (
      !selectedReceipt ||
      !canReview ||
      (decision === "approve" ? !canApprove : !canReject)
    ) {
      return;
    }

    const receiptId = selectedReceipt.id;
    const isApprove = decision === "approve";

    setReviewState({
      kind: "loading",
      message: isApprove ? "Approving receipt..." : "Rejecting receipt...",
    });

    try {
      const response = await fetch("/api/receipts/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          receiptId,
          decision,
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        error?: { message?: string };
      };

      if (!response.ok || !data.ok) {
        setReviewState({
          kind: "error",
          message: data.error?.message ?? `Failed to ${decision} receipt.`,
        });
        return;
      }

      setReceiptRows((previous) =>
        previous.map((row) =>
          row.id === receiptId
            ? {
                ...row,
                status: isApprove ? "verified" : "archived",
                ...(isApprove ? { isDuplicate: false, duplicateOf: null } : {}),
              }
            : row,
        ),
      );

      setReviewState({
        kind: "success",
        message: isApprove
          ? "Receipt approved by manager/admin. Duplicate marker has been cleared."
          : "Receipt rejected by manager/admin and moved to archived.",
      });
    } catch (error) {
      setReviewState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : `Could not ${decision} receipt. Please try again.`,
      });
    }
  };

  const onApprove = async () => {
    await onReview("approve");
  };

  const onReject = async () => {
    await onReview("reject");
  };

  const onAddComment = async () => {
    if (!selectedReceipt) {
      return;
    }

    const message = commentDraft.trim();
    if (!message) {
      setCommentState({
        kind: "error",
        message: "Write a comment before posting.",
      });
      return;
    }

    setCommentState({ kind: "loading", message: "Posting comment..." });

    const response = await fetch("/api/receipts/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        receiptId: selectedReceipt.id,
        message,
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      data?: {
        comment?: {
          id: string;
          author: string;
          authorRole: "employee" | "manager" | "admin" | "unknown";
          message: string;
          createdAt: string;
        };
      };
      error?: { message?: string };
    };

    if (!response.ok || !data.ok || !data.data?.comment) {
      setCommentState({
        kind: "error",
        message: data.error?.message ?? "Could not post comment.",
      });
      return;
    }

    setReceiptRows((previous) =>
      previous.map((row) =>
        row.id === selectedReceipt.id
          ? {
              ...row,
              comments: [data.data!.comment!, ...row.comments],
            }
          : row,
      ),
    );

    setCommentDraft("");
    setCommentState({ kind: "success", message: "Comment posted." });
  };

  const copyToClipboard = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(
        () => setCopiedField((current) => (current === field ? null : current)),
        1400,
      );
    } catch {
      setCommentState({
        kind: "error",
        message: "Could not copy text. Check browser clipboard permissions.",
      });
    }
  };

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      // Snapshot the initial filter values so we can detect real changes later.
      lastFilterKeyRef.current = JSON.stringify({
        categoryFilter,
        dateFrom,
        dateTo,
        pageSize,
        query,
        showAll,
        statusFilter,
      });
      return;
    }

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }

    if (!showAll && dateTo > todayIso) {
      return;
    }

    if (!showAll && dateFrom > dateTo) {
      return;
    }

    // Only re-fetch when the actual filter values changed, not when
    // fetchReceiptPage gets a new reference after React stabilises callbacks.
    const currentFilterKey = JSON.stringify({
      categoryFilter,
      dateFrom,
      dateTo,
      pageSize,
      query,
      showAll,
      statusFilter,
    });

    if (currentFilterKey === lastFilterKeyRef.current) {
      return;
    }

    lastFilterKeyRef.current = currentFilterKey;

    searchDebounceRef.current = window.setTimeout(() => {
      void fetchReceiptPage({ offset: 0, replace: true });
    }, 250);

    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, [
    categoryFilter,
    dateFrom,
    dateTo,
    fetchReceiptPage,
    pageSize,
    query,
    showAll,
    statusFilter,
    todayIso,
  ]);

  const openDateDialog = () => {
    setDraftDateFrom(dateFrom);
    setDraftDateTo(dateTo);
    setIsDateDialogOpen(true);
  };

  const applyDateRange = () => {
    if (dialogRangeError) {
      return;
    }

    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setShowAll(false);
    setIsDateDialogOpen(false);
  };

  const showAllReceipts = () => {
    setShowAll(true);
    setIsDateDialogOpen(false);
  };

  const onPageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {showReceiptBrowser ? "View all receipts" : "Receipt details"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {showReceiptBrowser
            ? "Search by receipt ID, filter by category and status, then open any receipt for full details and comments."
            : "Viewing a single receipt."}
        </p>

        {!showReceiptBrowser ? (
          <div className="mt-4">
            <Link
              href="/workspace/receipts"
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Back to receipts
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search receipt ID or vendor"
                className="pl-9"
              />
            </label>

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-9 py-2 text-sm text-slate-800"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category === "all" ? "All categories" : category}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={openDateDialog}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <CalendarDays className="h-4 w-4 text-slate-500" />
              Date range
            </button>

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | ReceiptStatus)
                }
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-9 py-2 text-sm text-slate-800"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {showReceiptBrowser ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <p className="text-xs text-slate-500">
              {showAll
                ? "Showing all receipts across all time periods."
                : `Showing receipts from ${dateFrom} to ${dateTo}.`}
            </p>

            {!showAll ? (
              <button
                type="button"
                onClick={showAllReceipts}
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Show all receipts
              </button>
            ) : null}

            <label className="relative block ml-auto">
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={String(pageSize)}
                onChange={(event) => {
                  void onPageSizeChange(Number(event.target.value));
                }}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-9 py-2 text-sm text-slate-800"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}/load
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      {isDateDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-date-dialog-title"
            className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="receipt-date-dialog-title"
                  className="text-lg font-semibold text-slate-950"
                >
                  Select date range
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pick a range to filter receipts, or switch back to all
                  receipts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDateDialogOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-500">
                  From
                </span>
                <Input
                  type="date"
                  value={draftDateFrom}
                  onChange={(event) => setDraftDateFrom(event.target.value)}
                  className="w-full"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-500">
                  To
                </span>
                <Input
                  type="date"
                  value={draftDateTo}
                  onChange={(event) => setDraftDateTo(event.target.value)}
                  max={todayIso}
                  className="w-full"
                />
              </label>
            </div>

            {dialogRangeError ? (
              <p className="mt-3 text-sm text-rose-600">{dialogRangeError}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={showAllReceipts}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Show all receipts
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsDateDialogOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyDateRange}
                  disabled={Boolean(dialogRangeError)}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
                >
                  Apply range
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-5",
          showReceiptBrowser ? "xl:grid-cols-[430px_1fr]" : "xl:grid-cols-1",
        )}
      >
        {showReceiptBrowser ? (
          <Card className="border-slate-200 h-fit">
            <CardHeader className="border-b border-slate-200 pb-4">
              <CardTitle className="text-lg text-slate-950">
                Receipts ({filteredReceipts.length})
              </CardTitle>
            </CardHeader>
            <div
              ref={listContainerRef}
              onScroll={onListScroll}
              className="max-h-[68vh] space-y-2 overflow-y-auto p-3"
            >
              {isRefreshing ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  Loading receipts...
                </div>
              ) : null}

              {listError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {listError}
                </div>
              ) : null}

              {filteredReceipts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  No receipts match your filters.
                </div>
              ) : (
                filteredReceipts.map((row) => {
                  const isActive = selectedReceipt?.receiptId === row.receiptId;

                  return (
                    <button
                      key={row.receiptId}
                      type="button"
                      onClick={() => setSelectedReceiptId(row.receiptId)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        isActive
                          ? "border-slate-900 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">
                            {row.receiptId}
                          </p>
                          <p
                            className={cn(
                              "text-sm",
                              isActive ? "text-slate-200" : "text-slate-600",
                            )}
                          >
                            {row.vendor}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 text-xs capitalize",
                            isActive
                              ? "border-white/30 text-white"
                              : "border-slate-200 text-slate-600",
                          )}
                        >
                          {row.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span
                          className={
                            isActive ? "text-slate-300" : "text-slate-500"
                          }
                        >
                          {row.category}
                        </span>
                        <span
                          className={
                            isActive ? "text-slate-100" : "text-slate-800"
                          }
                        >
                          {formatMoney(row.amount, row.currency)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}

              {hasMore ? (
                <button
                  type="button"
                  onClick={() => {
                    void loadMore();
                  }}
                  disabled={isLoadingMore || isRefreshing}
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                >
                  {isLoadingMore
                    ? "Loading more..."
                    : `Load next ${pageSize} receipts`}
                </button>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card className="border-slate-200">
          <CardContent className="space-y-5 p-5">
            {!selectedReceipt ? (
              <p className="text-sm text-slate-500">
                Select a receipt to see its details.
              </p>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      Preview
                    </p>
                    <div className="mt-3 flex min-h-55 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
                      {!selectedReceipt.fileUrl ? (
                        <div>
                          <Eye className="mx-auto h-6 w-6 text-slate-400" />
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            No preview available
                          </p>
                        </div>
                      ) : selectedReceipt.mimeType.startsWith("image/") ? (
                        <img
                          src={selectedReceipt.fileUrl}
                          alt={selectedReceipt.fileName}
                          className="max-h-64 w-full rounded-lg object-contain"
                        />
                      ) : selectedReceipt.mimeType === "application/pdf" ? (
                        <iframe
                          title={selectedReceipt.fileName}
                          src={selectedReceipt.fileUrl}
                          className="h-64 w-full rounded-lg"
                        />
                      ) : (
                        <div>
                          <Eye className="mx-auto h-6 w-6 text-slate-400" />
                          <p className="mt-2 text-sm font-medium text-slate-900">
                            Preview not supported for this file type
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedReceipt.fileUrl ? (
                      <a
                        href={selectedReceipt.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open original file
                      </a>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Receipt ID
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-950">
                          {selectedReceipt.receiptId}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              selectedReceipt.receiptId,
                              "receipt-id",
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {copiedField === "receipt-id" ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedField === "receipt-id" ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Vendor
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {selectedReceipt.vendor}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Amount
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {formatMoney(
                          selectedReceipt.amount,
                          selectedReceipt.currency,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Category
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        {selectedReceipt.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Status
                      </p>
                      <p className="mt-1 text-sm capitalize text-slate-800">
                        {selectedReceipt.status.replace("_", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Uploaded by role
                      </p>
                      <p className="mt-1 text-sm capitalize text-slate-800">
                        {selectedReceipt.uploadedByRole}
                      </p>
                    </div>
                  </div>
                </div>

                {canReview &&
                (selectedReceipt.status === "needs_review" ||
                  selectedReceipt.status === "draft") ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">
                      {selectedReceipt.status === "draft"
                        ? "This draft receipt can be verified by manager/admin."
                        : "This receipt requires manager/admin review."}
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      {selectedReceipt.status === "draft"
                        ? "Verification marks this receipt as ready for expense reports."
                        : "Policy violations and duplicate candidates can only be approved by manager/admin."}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onApprove}
                        disabled={reviewState.kind === "loading"}
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
                      >
                        {reviewState.kind === "loading"
                          ? "Approving..."
                          : selectedReceipt.status === "draft"
                            ? "Verify receipt"
                            : "Approve receipt"}
                      </button>
                      {selectedReceipt.status === "needs_review" ? (
                        <button
                          type="button"
                          onClick={onReject}
                          disabled={reviewState.kind === "loading"}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-60"
                        >
                          <X className="h-4 w-4" />
                          {reviewState.kind === "loading"
                            ? "Rejecting..."
                            : "Reject receipt"}
                        </button>
                      ) : null}
                      {reviewState.kind !== "idle" ? (
                        <span
                          className={cn(
                            "text-sm",
                            reviewState.kind === "error"
                              ? "text-rose-700"
                              : reviewState.kind === "success"
                                ? "text-emerald-700"
                                : "text-slate-600",
                          )}
                        >
                          {reviewState.message}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                      <User className="h-4 w-4 text-slate-500" /> Uploaded by
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {selectedReceipt.uploadedBy}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span>User ID: {selectedReceipt.uploadedByUserId}</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            selectedReceipt.uploadedByUserId,
                            "uploader-user-id",
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        {copiedField === "uploader-user-id" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiedField === "uploader-user-id" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <p className="mt-1 inline-flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />{" "}
                      {formatDateTime(selectedReceipt.uploadedAt)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Receipt date: {selectedReceipt.receiptDate}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">
                      Description
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {selectedReceipt.description}
                    </p>
                  </div>
                </div>

                {!canReview && selectedReceipt.status === "needs_review" ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    This receipt is in review queue. Only manager/admin can
                    approve it.
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">
                      Tax and vendor details
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-slate-700">
                      <p>GST rate: {selectedReceipt.gstRate ?? "-"}</p>
                      <p>CGST rate: {selectedReceipt.cgstRate ?? "-"}</p>
                      <p>IGST rate: {selectedReceipt.igstRate ?? "-"}</p>
                      <p>SGST rate: {selectedReceipt.sgstRate ?? "-"}</p>
                      <p>
                        CGST amount:{" "}
                        {selectedReceipt.cgstAmount === null
                          ? "-"
                          : formatMoney(
                              selectedReceipt.cgstAmount,
                              selectedReceipt.currency,
                            )}
                      </p>
                      <p>
                        IGST amount:{" "}
                        {selectedReceipt.igstAmount === null
                          ? "-"
                          : formatMoney(
                              selectedReceipt.igstAmount,
                              selectedReceipt.currency,
                            )}
                      </p>
                      <p>
                        SGST amount:{" "}
                        {selectedReceipt.sgstAmount === null
                          ? "-"
                          : formatMoney(
                              selectedReceipt.sgstAmount,
                              selectedReceipt.currency,
                            )}
                      </p>
                      <p>
                        Tax amount:{" "}
                        {selectedReceipt.taxAmount === null
                          ? "-"
                          : formatMoney(
                              selectedReceipt.taxAmount,
                              selectedReceipt.currency,
                            )}
                      </p>
                      <p>Vendor GSTIN: {selectedReceipt.vendorGstin ?? "-"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">
                      Processing metadata
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-slate-700">
                      <p>
                        Confidence score:{" "}
                        {selectedReceipt.confidenceScore ?? "-"}
                      </p>
                      <p>
                        File size: {formatBytes(selectedReceipt.fileSizeBytes)}
                      </p>
                      <p>
                        Duplicate flag:{" "}
                        {selectedReceipt.isDuplicate ? "Yes" : "No"}
                      </p>
                      <p>Duplicate of: {selectedReceipt.duplicateOf ?? "-"}</p>
                      <p>
                        Linked report:{" "}
                        {selectedReceipt.submittedInReportId ?? "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    <MessageSquare className="h-4 w-4 text-slate-500" />{" "}
                    Comments ({selectedReceipt.comments.length})
                  </p>
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows={3}
                      placeholder="Add context or review notes for this receipt"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onAddComment}
                        disabled={commentState.kind === "loading"}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        {commentState.kind === "loading"
                          ? "Posting..."
                          : "Post comment"}
                      </button>
                      {commentState.kind !== "idle" ? (
                        <span
                          className={cn(
                            "text-sm",
                            commentState.kind === "error"
                              ? "text-rose-700"
                              : commentState.kind === "success"
                                ? "text-emerald-700"
                                : "text-slate-600",
                          )}
                        >
                          {commentState.message}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {selectedReceipt.comments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      No comments on this receipt yet.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {selectedReceipt.comments.map((comment) => (
                        <article
                          key={comment.id}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">
                              {comment.author}
                              <span className="ml-2 text-xs capitalize text-slate-500">
                                {comment.authorRole}
                              </span>
                            </p>
                            <span className="text-xs text-slate-500">
                              {comment.createdAt}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700">
                            {comment.message}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
