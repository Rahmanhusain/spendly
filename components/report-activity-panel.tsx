"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { AlertCircle, Check, Loader, Send, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ExpenseReport } from "@/lib/repositories/reportRepository";
import type { UserRecord } from "@/lib/repositories/authRepository";

export type WorkspaceAuthContext = {
  tenantId: string;
  userId: string;
  role: "employee" | "manager" | "admin";
};

type ReportComment = {
  id: string;
  tenantId: string;
  reportId: string;
  authorUserId: string;
  authorName?: string | null;
  authorRole?: string | null;
  message: string;
  parentCommentId: string | null;
  isResolved: boolean;
  mentionedUserIds?: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type ReportAccessEntry = {
  id: string;
  tenantId: string;
  reportId: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  addedBy: string;
  addedByName?: string | null;
  createdAt: string;
};

type AccessListResponse = {
  ok: boolean;
  data?: { accessList: ReportAccessEntry[] };
  error?: { message?: string };
};

type CommentNode = ReportComment & { children: CommentNode[] };

type AuditLogEntry = {
  id: string;
  tenantId: string;
  userId: string | null;
  userName?: string | null;
  userRole?: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type ReimbursementMethod = "upi" | "bank" | "cash" | "other";

type ReimbursementRecord = {
  id: string;
  tenantId: string;
  reportId: string;
  method: ReimbursementMethod | null;
  referenceNumber: string | null;
  amountPaid: number;
  paidBy: string | null;
  paidByName?: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ActivitySummary = {
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  paidAt?: string;
  recentCommentCount: number;
};

type CommentsResponse = {
  ok: boolean;
  data?: { comments: ReportComment[] };
  error?: { message?: string };
};

type CommentPostResponse = {
  ok: boolean;
  data?: { comment: ReportComment };
  error?: { message?: string };
};

type AuditTrailResponse = {
  ok: boolean;
  data?: { auditLog: AuditLogEntry[]; activity: ActivitySummary };
  error?: { message?: string };
};

type ReimbursementResponse = {
  ok: boolean;
  data?: { reimbursement: ReimbursementRecord | null };
  error?: { message?: string };
};

type ReportUpdatedResponse = {
  ok: boolean;
  data?: { report: ExpenseReport };
  error?: { message?: string };
};

type MarkPaidResponse = {
  ok: boolean;
  data?: { report: ExpenseReport; reimbursement: ReimbursementRecord };
  error?: { message?: string };
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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

function formatDateShort(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatUserName(user: UserRecord | undefined) {
  if (!user) {
    return "Unknown user";
  }

  const name = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || user.email;
}

function formatAuditAction(action: string) {
  return action
    .replaceAll("_", " ")
    .replace(/\b\w/g, (part) => part.toUpperCase());
}

function getStatusPill(status: ExpenseReport["status"]) {
  const base = "inline-flex rounded-full px-2 py-1 text-xs font-medium";
  switch (status) {
    case "draft":
      return cn(base, "bg-slate-100 text-slate-700");
    case "submitted":
      return cn(base, "bg-blue-100 text-blue-700");
    case "info_requested":
      return cn(base, "bg-amber-100 text-amber-800");
    case "approved":
      return cn(base, "bg-emerald-100 text-emerald-700");
    case "rejected":
      return cn(base, "bg-rose-100 text-rose-700");
    case "paid":
      return cn(base, "bg-violet-100 text-violet-700");
    default:
      return base;
  }
}

function buildCommentTree(comments: ReportComment[]) {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    nodes.set(comment.id, { ...comment, children: [] });
  });

  comments.forEach((comment) => {
    const node = nodes.get(comment.id);
    if (!node) {
      return;
    }

    if (comment.parentCommentId && nodes.has(comment.parentCommentId)) {
      nodes.get(comment.parentCommentId)!.children.push(node);
      return;
    }

    roots.push(node);
  });

  const sortTree = (items: CommentNode[]) => {
    items.sort(
      (left, right) =>
        new Date(left.createdAt).getTime() -
        new Date(right.createdAt).getTime(),
    );

    items.forEach((item) => sortTree(item.children));
  };

  sortTree(roots);
  return roots;
}

export function ReportActivityPanel({
  report,
  reportItemsCount,
  authContext,
  tenantUsers,
  onReportUpdated,
}: {
  report: ExpenseReport;
  reportItemsCount: number;
  authContext: WorkspaceAuthContext;
  tenantUsers: UserRecord[];
  onReportUpdated: (report: ExpenseReport) => void;
}) {
  const [activePanel, setActivePanel] = useState<
    "overview" | "comments" | "audit" | "access"
  >("overview");
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [reimbursement, setReimbursement] =
    useState<ReimbursementRecord | null>(null);
  const [accessList, setAccessList] = useState<ReportAccessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<
    string | null
  >(null);
  const [isAddingAccess, setIsAddingAccess] = useState(false);
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [requestInfoReason, setRequestInfoReason] = useState("");
  const [isRequestingInfo, setIsRequestingInfo] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [markPaidMethod, setMarkPaidMethod] =
    useState<ReimbursementMethod>("upi");
  const [markPaidReference, setMarkPaidReference] = useState("");
  const [markPaidAmount, setMarkPaidAmount] = useState(
    String(report.totalAmount),
  );
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentUserIsManager =
    authContext.role === "manager" || authContext.role === "admin";
  const currentUserIsReportOwner = report.userId === authContext.userId;

  // For employees, only show users in access list as mentionable
  // For managers/admins, show all users but filter by access list for dropdown
  const accessListUserIds = useMemo(
    () => new Set(accessList.map((entry) => entry.userId)),
    [accessList],
  );

  const mentionableUsers = useMemo(
    () =>
      tenantUsers.filter((user) => {
        if (user.id === authContext.userId || user.status !== "active") {
          return false;
        }

        return (
          user.role === "manager" ||
          user.role === "admin" ||
          accessListUserIds.has(user.id)
        );
      }),
    [authContext.userId, tenantUsers, accessListUserIds],
  );
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const mentionedSet = useMemo(
    () => new Set(mentionedUserIds),
    [mentionedUserIds],
  );

  const handleInsertMention = useCallback((user: UserRecord) => {
    const mentionToken = `@${formatUserName(user)}`;

    setMentionedUserIds((current) =>
      current.includes(user.id) ? current : [...current, user.id],
    );

    setCommentDraft((current) => {
      const textArea = commentTextareaRef.current;
      if (!textArea) {
        return current
          ? `${current}${current.endsWith(" ") ? "" : " "}${mentionToken} `
          : `${mentionToken} `;
      }

      const selectionStart = textArea.selectionStart ?? current.length;
      const selectionEnd = textArea.selectionEnd ?? current.length;
      const before = current.slice(0, selectionStart);
      const after = current.slice(selectionEnd);
      const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
      const needsSpaceAfter = after.length > 0 && !/^\s/.test(after);

      return `${before}${needsSpaceBefore ? " " : ""}${mentionToken}${needsSpaceAfter ? " " : ""}${after}`;
    });

    window.requestAnimationFrame(() => {
      commentTextareaRef.current?.focus();
    });
  }, []);

  const loadReportMeta = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        commentsResponse,
        auditResponse,
        reimbursementResponse,
        accessResponse,
      ] = await Promise.all([
        fetch(`/api/reports/${report.id}/comments`, {
          credentials: "include",
        }),
        fetch(`/api/reports/${report.id}/audit-trail`, {
          credentials: "include",
        }),
        fetch(`/api/reports/${report.id}/mark-paid`, {
          credentials: "include",
        }),
        fetch(`/api/reports/${report.id}/access`, {
          credentials: "include",
        }),
      ]);

      const [
        commentsPayload,
        auditPayload,
        reimbursementPayload,
        accessPayload,
      ] = (await Promise.all([
        commentsResponse.json(),
        auditResponse.json(),
        reimbursementResponse.json(),
        accessResponse.json(),
      ])) as [
        CommentsResponse,
        AuditTrailResponse,
        ReimbursementResponse,
        AccessListResponse | { ok: false },
      ];

      if (commentsResponse.ok && commentsPayload.ok) {
        setComments(commentsPayload.data?.comments ?? []);
      }
      if (auditResponse.ok && auditPayload.ok) {
        setAuditLog(auditPayload.data?.auditLog ?? []);
        setActivity(auditPayload.data?.activity ?? null);
      }
      if (reimbursementResponse.ok && reimbursementPayload.ok) {
        setReimbursement(reimbursementPayload.data?.reimbursement ?? null);
      }
      if (accessResponse.ok && "ok" in accessPayload && accessPayload.ok) {
        setAccessList(accessPayload.data?.accessList ?? []);
      }

      if (
        !commentsResponse.ok ||
        !auditResponse.ok ||
        !reimbursementResponse.ok
      ) {
        throw new Error(
          commentsPayload.error?.message ||
            auditPayload.error?.message ||
            reimbursementPayload.error?.message ||
            "Failed to load report activity",
        );
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load report activity",
      );
    } finally {
      setIsLoading(false);
    }
  }, [report.id, currentUserIsManager, currentUserIsReportOwner]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReportMeta();
  }, [loadReportMeta]);

  const syncReport = useCallback(
    (updatedReport: ExpenseReport) => {
      onReportUpdated(updatedReport);
      setMarkPaidAmount(String(updatedReport.totalAmount));
    },
    [onReportUpdated],
  );

  const handleAddUserToAccess = useCallback(async () => {
    if (!selectedUserForAccess) {
      setError("Select a user to add");
      return;
    }

    setIsAddingAccess(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${report.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: selectedUserForAccess }),
      });

      const payload = (await response.json()) as AccessListResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || "Failed to add access");
      }

      setSelectedUserForAccess(null);
      setSuccessMessage("User added to report access");
      window.setTimeout(() => setSuccessMessage(null), 2500);
      void loadReportMeta();
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Failed to add access",
      );
    } finally {
      setIsAddingAccess(false);
    }
  }, [selectedUserForAccess, report.id, loadReportMeta]);

  const handleRemoveUserFromAccess = useCallback(
    async (userId: string) => {
      if (
        !window.confirm(
          "Remove this user from report access? They will no longer be able to view comments.",
        )
      ) {
        return;
      }

      setError(null);
      try {
        const response = await fetch(
          `/api/reports/${report.id}/access?userId=${userId}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );

        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message || "Failed to remove access");
        }

        setAccessList((current) =>
          current.filter((entry) => entry.userId !== userId),
        );
        setSuccessMessage("User removed from report access");
        window.setTimeout(() => setSuccessMessage(null), 2500);
        void loadReportMeta();
      } catch (removeError) {
        setError(
          removeError instanceof Error
            ? removeError.message
            : "Failed to remove access",
        );
      }
    },
    [loadReportMeta, report.id],
  );

  const handlePostComment = useCallback(async () => {
    const message = commentDraft.trim();
    if (!message) {
      setError("Write a comment before posting.");
      return;
    }

    setIsPostingComment(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${report.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message,
          parentCommentId: replyToId,
          mentionedUserIds,
        }),
      });

      const payload = (await response.json()) as CommentPostResponse;
      if (!response.ok || !payload.ok || !payload.data?.comment) {
        throw new Error(payload.error?.message || "Failed to post comment");
      }

      setCommentDraft("");
      setReplyToId(null);
      setMentionedUserIds([]);
      setSuccessMessage("Comment posted");
      window.setTimeout(() => setSuccessMessage(null), 2500);
      void loadReportMeta();
    } catch (postError) {
      setError(
        postError instanceof Error
          ? postError.message
          : "Failed to post comment",
      );
    } finally {
      setIsPostingComment(false);
    }
  }, [commentDraft, loadReportMeta, mentionedUserIds, replyToId, report.id]);

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!window.confirm("Delete this comment?")) {
        return;
      }

      setError(null);
      try {
        const response = await fetch(
          `/api/reports/${report.id}/comments/${commentId}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );

        const payload = await response.json();
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || "Failed to delete comment");
        }

        setComments((current) =>
          current.filter((comment) => comment.id !== commentId),
        );
        setSuccessMessage("Comment deleted");
        window.setTimeout(() => setSuccessMessage(null), 2000);
        void loadReportMeta();
      } catch (deleteError) {
        setError(
          deleteError instanceof Error
            ? deleteError.message
            : "Failed to delete comment",
        );
      }
    },
    [loadReportMeta, report.id],
  );

  const handleRequestInfo = useCallback(async () => {
    const reason = requestInfoReason.trim();
    if (!reason) {
      setError("Enter a reason before requesting information.");
      return;
    }

    setIsRequestingInfo(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${report.id}/request-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      const payload = (await response.json()) as ReportUpdatedResponse;
      if (!response.ok || !payload.ok || !payload.data?.report) {
        throw new Error(
          payload.error?.message || "Failed to request information",
        );
      }

      syncReport(payload.data.report);
      setRequestInfoOpen(false);
      setRequestInfoReason("");
      setSuccessMessage("Information request sent");
      window.setTimeout(() => setSuccessMessage(null), 2500);
      void loadReportMeta();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to request information",
      );
    } finally {
      setIsRequestingInfo(false);
    }
  }, [loadReportMeta, requestInfoReason, report.id, syncReport]);

  const handleApproveReport = useCallback(async () => {
    setIsApproving(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${report.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Failed to approve report");
      }

      syncReport(payload as ExpenseReport);
      setSuccessMessage("Report approved");
      window.setTimeout(() => setSuccessMessage(null), 2500);
      void loadReportMeta();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Failed to approve report",
      );
    } finally {
      setIsApproving(false);
    }
  }, [loadReportMeta, report.id, syncReport]);

  const handleRejectReport = useCallback(async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    setIsRejecting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${report.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Failed to reject report");
      }

      // If server returns a draft status for a rejected report, coerce it to 'rejected'
      const updated = (payload as ExpenseReport) || null;
      if (updated && updated.status === "draft") {
        updated.status = "rejected" as ExpenseReport["status"];
      }

      if (updated) syncReport(updated);
      setSuccessMessage("Report rejected");
      window.setTimeout(() => setSuccessMessage(null), 2500);
      setRejectOpen(false);
      setRejectReason("");
      void loadReportMeta();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Failed to reject report",
      );
    } finally {
      setIsRejecting(false);
    }
  }, [loadReportMeta, rejectReason, report.id, syncReport]);

  const handleSubmitResponse = useCallback(async () => {
    setIsSubmittingResponse(true);
    setError(null);

    try {
      const fromStatus = report.status;
      const response = await fetch(`/api/reports/${report.id}/submit`, {
        method: "POST",
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Failed to submit response");
      }

      syncReport(payload as ExpenseReport);
      setSuccessMessage(
        fromStatus === "info_requested"
          ? "Response submitted"
          : "Report submitted for approval",
      );
      window.setTimeout(() => setSuccessMessage(null), 2500);
      void loadReportMeta();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit response",
      );
    } finally {
      setIsSubmittingResponse(false);
    }
  }, [loadReportMeta, report.id, syncReport]);

  const handleMarkPaid = useCallback(async () => {
    const amount = Number(markPaidAmount || report.totalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid paid amount.");
      return;
    }

    setIsMarkingPaid(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${report.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          method: markPaidMethod,
          referenceNumber: markPaidReference.trim() || undefined,
          amountPaid: amount,
        }),
      });

      const payload = (await response.json()) as MarkPaidResponse;
      if (!response.ok || !payload.ok || !payload.data?.report) {
        throw new Error(
          payload.error?.message || "Failed to mark report as paid",
        );
      }

      syncReport(payload.data.report);
      setReimbursement(payload.data.reimbursement);
      setMarkPaidOpen(false);
      setMarkPaidReference("");
      setSuccessMessage("Report marked as paid");
      window.setTimeout(() => setSuccessMessage(null), 2500);
      void loadReportMeta();
    } catch (paidError) {
      setError(
        paidError instanceof Error
          ? paidError.message
          : "Failed to mark report as paid",
      );
    } finally {
      setIsMarkingPaid(false);
    }
  }, [
    loadReportMeta,
    markPaidAmount,
    markPaidMethod,
    markPaidReference,
    report.totalAmount,
    report.id,
    syncReport,
  ]);

  const renderCommentNode = (comment: CommentNode, depth = 0): ReactElement => {
    const mentionedNames = (comment.mentionedUserIds || [])
      .map((id) => tenantUsers.find((user) => user.id === id))
      .filter(Boolean)
      .map((user) => formatUserName(user as UserRecord));

    return (
      <div
        key={comment.id}
        className={cn(
          "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
          depth > 0 ? "ml-6 mt-3" : "",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-slate-950">
                {comment.authorName || "Unknown user"}
              </p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600">
                {comment.authorRole || "member"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {formatDateTime(comment.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReplyToId(comment.id)}
              className="text-xs font-medium text-slate-600 hover:text-slate-950"
            >
              Reply
            </button>
            {comment.authorUserId === authContext.userId ? (
              <button
                type="button"
                onClick={() => void handleDeleteComment(comment.id)}
                className="text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
          {comment.message}
        </p>

        {mentionedNames.length > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Mentioned: {mentionedNames.join(", ")}
          </p>
        ) : null}

        {comment.children.length > 0 ? (
          <div className="mt-4 space-y-3 border-l border-slate-200 pl-4">
            {comment.children.map((child) =>
              renderCommentNode(child, depth + 1),
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Total
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950">
            {formatMoney(report.totalAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Status
          </p>
          <p className={cn("mt-1", getStatusPill(report.status))}>
            {report.status}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Created
          </p>
          <p className="mt-1">{formatDateShort(report.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Items
          </p>
          <p className="mt-1 font-medium text-slate-950">
            {reportItemsCount} receipt{reportItemsCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(["overview", "comments", "audit", "access"] as const)
              .filter(
                (panel) =>
                  panel !== "access" ||
                  currentUserIsManager ||
                  currentUserIsReportOwner,
              )
              .map((panel) => (
                <button
                  key={panel}
                  type="button"
                  onClick={() =>
                    setActivePanel(
                      panel as "overview" | "comments" | "audit" | "access",
                    )
                  }
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    activePanel === panel
                      ? "bg-slate-950 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {panel === "overview"
                    ? "Overview"
                    : panel === "comments"
                      ? `Comments (${comments.length})`
                      : panel === "access"
                        ? `Access (${accessList.length})`
                        : "Audit trail"}
                </button>
              ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentUserIsManager && report.status === "submitted" ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleApproveReport()}
                  disabled={isApproving}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                >
                  {isApproving ? "Approving..." : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectReason("");
                    setRejectOpen(true);
                  }}
                  disabled={isApproving || isRejecting}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 transition-colors hover:bg-rose-100 disabled:opacity-60"
                >
                  {isRejecting ? "Rejecting..." : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRequestInfoReason("");
                    setRequestInfoOpen(true);
                  }}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
                >
                  Request info
                </button>
              </>
            ) : null}

            {currentUserIsManager && report.status === "approved" ? (
              <button
                type="button"
                onClick={() => {
                  setMarkPaidAmount(String(report.totalAmount));
                  setMarkPaidReference("");
                  setMarkPaidMethod("upi");
                  setMarkPaidOpen(true);
                }}
                className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                Mark as paid
              </button>
            ) : null}

            {authContext.role === "employee" &&
            report.userId === authContext.userId &&
            (report.status === "info_requested" ||
              report.status === "draft") ? (
              <button
                type="button"
                onClick={() => void handleSubmitResponse()}
                disabled={
                  isLoading || isSubmittingResponse || reportItemsCount === 0
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {isLoading || isSubmittingResponse
                  ? "Submitting..."
                  : report.status === "info_requested"
                    ? "Submit response"
                    : "Submit for approval"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <div className="flex gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{successMessage}</p>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">
          Loading comments, audit trail, and payment status...
        </p>
      ) : null}

      {activePanel === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Period
              </p>
              <p className="mt-1 font-medium text-slate-950">
                {report.periodStart || report.periodEnd
                  ? `${formatDateShort(report.periodStart)} to ${formatDateShort(report.periodEnd)}`
                  : "Not specified"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Payment status
              </p>
              <p className="mt-1 font-medium text-slate-950">
                {reimbursement?.paidAt
                  ? `Paid via ${reimbursement.method?.toUpperCase() || "method"}`
                  : "Pending reimbursement"}
              </p>
              {reimbursement?.referenceNumber ? (
                <p className="mt-1 text-xs text-slate-500">
                  Reference: {reimbursement.referenceNumber}
                </p>
              ) : null}
            </div>
          </div>

          {report.description ? (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {report.description}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {activePanel === "comments" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Discussion
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Threaded replies and mentions for this report.
                </p>
              </div>
              {replyToId ? (
                <button
                  type="button"
                  onClick={() => setReplyToId(null)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-950"
                >
                  Cancel reply
                </button>
              ) : null}
            </div>

            {replyToId ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Replying to an existing comment.
              </p>
            ) : null}

            <Textarea
              ref={commentTextareaRef}
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Write a comment and use the mention picker to notify teammates."
              className="mt-4 min-h-28"
            />

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Mention teammates
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {authContext.role === "employee"
                  ? "Only teammates who already have access to this report will appear here."
                  : "Click a name to insert an @mention into the comment draft."}
              </p>
              {mentionableUsers.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No report-access users available for mentions yet.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {mentionableUsers.map((user) => {
                    const selected = mentionedSet.has(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleInsertMention(user)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                          selected
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        <span className="font-medium">
                          @{formatUserName(user)}
                        </span>
                        <span
                          className={cn(
                            "text-[11px] uppercase tracking-[0.12em]",
                            selected ? "text-white/70" : "text-slate-500",
                          )}
                        >
                          {user.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {mentionedUserIds.length > 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Current mentions:{" "}
                  {mentionedUserIds
                    .map(
                      (id) =>
                        `@${formatUserName(tenantUsers.find((user) => user.id === id))}`,
                    )
                    .join(", ")}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Mentioned users will receive in-app notifications.
              </p>
              <button
                type="button"
                onClick={() => void handlePostComment()}
                disabled={isPostingComment || !commentDraft.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:bg-slate-300"
              >
                {isPostingComment ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Post comment
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {commentTree.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No comments yet. Start the discussion for this report.
              </p>
            ) : (
              commentTree.map((comment) => renderCommentNode(comment))
            )}
          </div>
        </div>
      ) : null}

      {activePanel === "audit" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Activity summary
              </p>
              <p className="mt-2 font-medium text-slate-950">
                {activity?.recentCommentCount ?? 0} comments in the last 7 days
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Created{" "}
                {formatDateShort(activity?.createdAt || report.createdAt)}
              </p>
              {activity?.submittedAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Submitted {formatDateShort(activity.submittedAt)}
                </p>
              ) : null}
              {activity?.approvedAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Approved {formatDateShort(activity.approvedAt)}
                </p>
              ) : null}
              {activity?.paidAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Paid {formatDateShort(activity.paidAt)}
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Payment details
              </p>
              {reimbursement ? (
                <>
                  <p className="mt-2 font-medium text-slate-950">
                    {reimbursement.method
                      ? reimbursement.method.toUpperCase()
                      : "Unspecified"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Amount {formatMoney(reimbursement.amountPaid)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Paid by {reimbursement.paidByName || "Unknown"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Paid on {formatDateShort(reimbursement.paidAt)}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-slate-600">
                  No reimbursement has been recorded yet.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {auditLog.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No audit events recorded for this report yet.
              </p>
            ) : (
              auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {formatAuditAction(entry.action)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.userName || "System"} ·{" "}
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {entry.userRole || "system"}
                    </span>
                  </div>
                  {entry.metadata ? (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {activePanel === "access" ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Share access
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Add employees to this report so they can see comments and be
                mentioned. Managers and admins always have full access.
              </p>
            </div>

            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Add employee to access list
              </p>
              <div className="mt-3 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={selectedUserForAccess || ""}
                    onChange={(event) =>
                      setSelectedUserForAccess(event.target.value || null)
                    }
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="">Select an employee...</option>
                    {tenantUsers
                      .filter(
                        (user) =>
                          user.id !== authContext.userId &&
                          user.role === "employee" &&
                          user.status === "active" &&
                          !accessListUserIds.has(user.id),
                      )
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {formatUserName(user)}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleAddUserToAccess()}
                    disabled={isAddingAccess || !selectedUserForAccess}
                    className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-900 disabled:bg-slate-300"
                  >
                    {isAddingAccess ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {accessList.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                No employees added yet. Use the form above to add team members.
              </p>
            ) : (
              <div>
                <p className="mb-3 text-sm font-medium text-slate-700">
                  Current access ({accessList.length})
                </p>
                <div className="space-y-2">
                  {accessList.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {entry.userName || entry.userEmail}
                        </p>
                        <p className="text-xs text-slate-500">
                          Added by {entry.addedByName} on{" "}
                          {formatDateShort(entry.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void handleRemoveUserFromAccess(entry.userId)
                        }
                        className="text-xs font-medium text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {requestInfoOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Request additional information
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Ask the employee for more context without rejecting the
                  report.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRequestInfoOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <Textarea
                value={requestInfoReason}
                onChange={(event) => setRequestInfoReason(event.target.value)}
                placeholder="Explain what information is needed..."
                className="min-h-28"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRequestInfoOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleRequestInfo()}
                  disabled={isRequestingInfo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                >
                  {isRequestingInfo ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : null}
                  Send request
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rejectOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Reject report
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Provide a reason so the employee can fix and resubmit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <Textarea
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Enter a rejection reason..."
                className="min-h-28"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleRejectReport()}
                  disabled={isRejecting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                >
                  {isRejecting ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : null}
                  Reject report
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {markPaidOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Mark report as paid
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Record the reimbursement details and notify the employee.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMarkPaidOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition-colors hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Payment method
                  </label>
                  <select
                    value={markPaidMethod}
                    onChange={(event) =>
                      setMarkPaidMethod(
                        event.target.value as ReimbursementMethod,
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Amount paid
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={markPaidAmount}
                    onChange={(event) => setMarkPaidAmount(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Reference number
                </label>
                <Input
                  value={markPaidReference}
                  onChange={(event) => setMarkPaidReference(event.target.value)}
                  placeholder="Transaction ID, cheque no., or note"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMarkPaidOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleMarkPaid()}
                  disabled={isMarkingPaid}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
                >
                  {isMarkingPaid ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : null}
                  Mark as paid
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
