"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, ShieldCheck, X } from "lucide-react";
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
  status: string;
  totalAmount: number;
  rejectionReason: string | null;
};

type ApprovalListItem = {
  approval: Approval;
  report: Report | null;
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

export function ApprovalsWorkspace({ canApprove }: { canApprove: boolean }) {
  const [items, setItems] = useState<ApprovalListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    kind: "idle" | "success" | "error";
    message: string;
  }>({ kind: "idle", message: "" });
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

  const runDecision = async (item: ApprovalListItem, decision: "approve" | "reject") => {
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
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
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
                    const reasonDraft = rejectReasonById[item.approval.id] ?? "";
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
                            <p className="font-medium text-slate-950">{reportTitle}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Submitted {formatDateTime(item.approval.createdAt)} ·{" "}
                              {reportAmount}
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
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">
                  Decision helpers
                </CardTitle>
                <CardDescription>
                  Use policy signals to move reports quickly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Submitted
                  reports appear in this queue.
                </p>
                <p className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-amber-600" /> Oldest submitted
                  entries are reviewed first.
                </p>
                <p className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-slate-900" /> Approve or
                  reject from one place.
                </p>
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
