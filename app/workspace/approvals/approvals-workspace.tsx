"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ApprovalStatus = "submitted" | "approved" | "rejected" | "info_requested";

type Approval = {
  id: string;
  reportId: string;
  status: ApprovalStatus;
  createdAt: string;
};

type Report = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  totalAmount: number;
  rejectionReason: string | null;
};

type ApprovalListItem = {
  approval: Approval;
  report: Report | null;
  reportCreator?: {
    id: string;
    name: string;
  } | null;
};

type ApprovalsApiResponse = {
  data?: ApprovalListItem[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  error?: string;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
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

function formatItemAmount(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.00";
  }
  return numeric.toFixed(2);
}

export function ApprovalsWorkspace({ canApprove }: { canApprove: boolean }) {
  const [items, setItems] = useState<ApprovalListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "idle" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
  const [selectedReportDetails, setSelectedReportDetails] = useState<{
    report: Report | null;
    items: Array<{
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
    }>;
  } | null>(null);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [activeAction, setActiveAction] = useState<{
    approvalId: string;
    kind: "approve" | "reject";
  } | null>(null);
  const [rejectReasonById, setRejectReasonById] = useState<
    Record<string, string>
  >({});

  const pendingCount = useMemo(() => items.length, [items.length]);

  useEffect(() => {
    if (!canApprove) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchPendingApprovals() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/approvals?limit=50&offset=0", {
          method: "GET",
          credentials: "include",
        });

        const data = (await response.json()) as ApprovalsApiResponse;
        if (!response.ok) {
          throw new Error(data.error || "Failed to load approvals.");
        }

        if (!isMounted) {
          return;
        }

        setItems(data.data ?? []);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }

        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load pending approvals.",
        );
      } finally {
        if (!isMounted) {
          return;
        }
        setIsLoading(false);
      }
    }

    void fetchPendingApprovals();

    return () => {
      isMounted = false;
    };
  }, [canApprove]);

  const runDecision = async (
    item: ApprovalListItem,
    decision: "approve" | "reject",
  ) => {
    if (!canApprove) {
      return;
    }

    const reason = rejectReasonById[item.approval.id]?.trim() ?? "";
    if (decision === "reject" && reason.length === 0) {
      setFeedback({
        kind: "error",
        message: "Rejection reason is required before rejecting a report.",
      });
      return;
    }

    setFeedback({ kind: "idle", message: "" });
    setActiveAction({ approvalId: item.approval.id, kind: decision });

    try {
      const response = await fetch(
        `/api/approvals/${item.approval.id}/${decision}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            comments: reason.length > 0 ? reason : undefined,
          }),
        },
      );

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${decision} report.`);
      }

      setItems((current) =>
        current.filter((entry) => entry.approval.id !== item.approval.id),
      );
      setRejectReasonById((current) => {
        const { [item.approval.id]: _, ...rest } = current;
        return rest;
      });
      setFeedback({
        kind: "success",
        message:
          decision === "approve"
            ? "Report approved successfully."
            : "Report rejected successfully.",
      });
    } catch (decisionError) {
      setFeedback({
        kind: "error",
        message:
          decisionError instanceof Error
            ? decisionError.message
            : `Could not ${decision} report. Please try again.`,
      });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
              Approvals
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
              Review what needs attention.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Keep policy checks visible and approve reports faster.
            </p>
          </div>
          <Badge className="w-fit border-slate-200 bg-slate-50 text-slate-700">
            {pendingCount} items pending
          </Badge>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-slate-950">Queue</CardTitle>
              <CardDescription>
                Most recent reports waiting for manager/admin decision.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!canApprove ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Only manager/admin users can access and action approvals.
                </div>
              ) : null}

              {canApprove && isLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  Loading pending approvals...
                </div>
              ) : null}

              {canApprove && error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {canApprove && feedback.kind !== "idle" ? (
                <div
                  className={cn(
                    "rounded-2xl border p-4 text-sm",
                    feedback.kind === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700",
                  )}
                >
                  {feedback.message}
                </div>
              ) : null}

              {canApprove && !isLoading && !error && items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  No pending approvals right now.
                </div>
              ) : null}

              {canApprove
                ? items.map((item) => {
                    const reportTitle =
                      item.report?.title || `Report ${item.approval.reportId}`;
                    const reportAmount =
                      item.report?.totalAmount !== undefined
                        ? formatMoney(item.report.totalAmount)
                        : "Amount unavailable";
                    const creatorName =
                      item.reportCreator?.name || "Unknown user";
                    const creatorId =
                      item.reportCreator?.id ||
                      ((item.report as { userId?: string } | null)?.userId ??
                        "Unknown");
                    const reasonDraft =
                      rejectReasonById[item.approval.id] ?? "";
                    const isApproving =
                      activeAction?.approvalId === item.approval.id &&
                      activeAction.kind === "approve";
                    const isRejecting =
                      activeAction?.approvalId === item.approval.id &&
                      activeAction.kind === "reject";
                    const isBusy =
                      activeAction?.approvalId === item.approval.id;

                    return (
                      <article
                        key={item.approval.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-950">
                              {reportTitle}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              Submitted{" "}
                              {formatDateTime(item.approval.createdAt)} ·{" "}
                              {reportAmount}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Created by: {creatorName} · User ID: {creatorId}
                            </p>
                          </div>
                          <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                            {item.approval.status}
                          </Badge>
                        </div>

                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                            Rejection reason
                          </span>
                          <Textarea
                            rows={2}
                            value={reasonDraft}
                            onChange={(event) =>
                              setRejectReasonById((current) => ({
                                ...current,
                                [item.approval.id]: event.target.value,
                              }))
                            }
                            placeholder="Required only for reject action"
                            disabled={isBusy}
                          />
                        </label>

                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={async () => {
                              // fetch report details and open side panel
                              try {
                                const resp = await fetch(
                                  `/api/reports/${item.approval.reportId}`,
                                  {
                                    method: "GET",
                                    credentials: "include",
                                  },
                                );
                                const data = await resp.json();
                                if (!resp.ok)
                                  throw new Error(
                                    data.error ||
                                      "Failed to load report details",
                                  );
                                setSelectedReportDetails({
                                  report: data.report ?? null,
                                  items: data.items ?? [],
                                });
                                setShowReportPanel(true);
                              } catch (err) {
                                setFeedback({
                                  kind: "error",
                                  message:
                                    err instanceof Error
                                      ? err.message
                                      : String(err),
                                });
                              }
                            }}
                            disabled={isBusy}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                          >
                            View report details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void runDecision(item, "approve");
                            }}
                            disabled={isBusy}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-60"
                          >
                            {isApproving ? "Approving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void runDecision(item, "reject");
                            }}
                            disabled={isBusy}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-60"
                          >
                            <X className="h-4 w-4" />
                            {isRejecting ? "Rejecting..." : "Reject"}
                          </button>
                        </div>
                      </article>
                    );
                  })
                : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-slate-950">
                      Report details
                    </CardTitle>
                    <CardDescription>
                      {showReportPanel && selectedReportDetails
                        ? "Review receipt-level details while keeping queue visible."
                        : "Select a report from Queue using View report details."}
                    </CardDescription>
                  </div>
                  {showReportPanel ? (
                    <button
                      type="button"
                      className="text-sm text-slate-500"
                      onClick={() => setShowReportPanel(false)}
                    >
                      Close
                    </button>
                  ) : null}
                </div>
                {showReportPanel && selectedReportDetails ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium text-slate-900">
                      {selectedReportDetails.report?.title ?? "Report details"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedReportDetails.report?.description ||
                        "No description provided."}
                    </p>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {!showReportPanel || !selectedReportDetails ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                    Details will appear here on the right side of the queue.
                  </p>
                ) : (
                  <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
                    {selectedReportDetails.items.map((it) => (
                      <div
                        key={it.id}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-slate-900">
                              {it.vendor ?? "Unknown vendor"}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              ₹{formatItemAmount(it.amount)} ·{" "}
                              {it.category ?? "uncategorized"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Receipt date: {it.receiptDate} · Uploaded:{" "}
                              {new Date(it.uploadedAt).toLocaleString()}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Uploaded by: {it.uploadedByName ?? "Unknown"} (
                              {it.uploadedByRole ?? "unknown"}) · ID:{" "}
                              {it.uploadedById ?? "—"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {it.fileUrl ? (
                              <a
                                href={it.fileUrl}
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
                              {it.mimeType ?? ""}{" "}
                              {it.vendorGstin
                                ? `· GSTIN ${it.vendorGstin}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Link
              href="/workspace/create-report"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-900"
            >
              Open expense reports
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
