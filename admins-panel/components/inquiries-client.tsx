"use client";

/* eslint-disable react-hooks/static-components */

import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition, useRef } from "react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Search,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Calendar,
  Hash,
  ArrowLeft,
  Copy,
  Check,
} from "lucide-react";
import type {
  ContactInquiryRecord,
  InquiryStatus,
} from "../lib/repositories/adminRepository";
import { RefreshButton } from "./refresh-button";

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "New",
  in_review: "In Review",
  reviewed: "Reviewed",
  closed: "Closed",
};

const STATUS_PILL: Record<InquiryStatus, string> = {
  new: "bg-slate-950 text-white",
  in_review: "bg-slate-200 text-slate-800",
  reviewed: "bg-slate-100 text-slate-600",
  closed: "bg-slate-50 text-slate-400 border border-slate-200",
};

const REASON_LABELS: Record<string, string> = {
  complaint: "Complaint",
  suggestion: "Suggestion",
  feedback: "Feedback",
  query: "General Query",
  support: "Product Support",
  partnership: "Partnership",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Filters {
  search: string;
  status: string;
  reason: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  rows: ContactInquiryRecord[];
  total: number;
  offset: number;
  limit: number;
  filters: Filters;
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy email"
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      {copied ? (
        <Check className="h-3 w-3 text-slate-600" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
      <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function InquiriesClient({
  rows,
  total,
  offset,
  limit,
  filters,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Detail panel state
  const [selected, setSelected] = useState<ContactInquiryRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false); // mobile: show detail panel
  const [editStatus, setEditStatus] = useState<InquiryStatus | "">("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Debounced search
  const [searchInput, setSearchInput] = useState(filters.search);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ search: value, offset: "0" });
    }, 400);
  }

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const hasFilters = Object.values(filters).some(Boolean);

  function navigate(overrides: Partial<Filters & { offset: string }>) {
    const merged = {
      ...filters,
      search: searchInput,
      offset: String(offset),
      ...overrides,
    };
    const sp = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  function openDetail(inq: ContactInquiryRecord) {
    setSelected(inq);
    setEditStatus(inq.status);
    setEditNotes(inq.admin_notes ?? "");
    setSaveError(null);
    setSaveSuccess(false);
    setShowDetail(true);
  }

  async function handleSave() {
    if (!selected || !editStatus) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/inquiries/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus, admin_notes: editNotes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update.");
      const updated = {
        ...selected,
        status: editStatus as InquiryStatus,
        admin_notes: editNotes,
      };
      setSelected(updated);
      setSaveSuccess(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    editStatus !== selected?.status ||
    editNotes !== (selected?.admin_notes ?? "");

  // ── List panel ──────────────────────────────────────────────────────────────
  const ListPanel = () => (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-0">
        {isPending ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 space-y-2">
                <div className="flex gap-2">
                  <div className="h-5 w-14 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageSquare className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">No inquiries found.</p>
            {hasFilters && (
              <button
                onClick={() =>
                  navigate({
                    search: "",
                    status: "",
                    reason: "",
                    dateFrom: "",
                    dateTo: "",
                    offset: "0",
                  })
                }
                className="mt-1 text-xs text-slate-950 underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((inq) => (
              <li key={inq.id}>
                <button
                  onClick={() => openDetail(inq)}
                  className={`w-full px-4 py-3.5 text-left transition-colors hover:bg-slate-50 sm:px-5 sm:py-4 ${selected?.id === inq.id ? "bg-slate-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL[inq.status]}`}
                        >
                          {STATUS_LABELS[inq.status]}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                          {REASON_LABELS[inq.reason] ?? inq.reason}
                        </span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium text-slate-950">
                        {inq.subject}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {inq.sender_name} · {inq.sender_email}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-slate-400 tabular-nums">
                      {formatDate(inq.created_at)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > limit && (
          <>
            <Separator />
            <div className="flex items-center justify-between px-5 py-3">
              <p className="text-xs text-slate-500">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0 || isPending}
                  onClick={() =>
                    navigate({ offset: String(Math.max(0, offset - limit)) })
                  }
                  className="h-8 rounded-lg border-slate-200 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-slate-600">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total || isPending}
                  onClick={() => navigate({ offset: String(offset + limit) })}
                  className="h-8 rounded-lg border-slate-200 px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  // ── Detail panel ────────────────────────────────────────────────────────────
  const DetailPanel = () => (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-0">
        {!selected ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <MessageSquare className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              Select an inquiry to review it.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Header */}
            <div className="space-y-2 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PILL[selected.status]}`}
                >
                  {STATUS_LABELS[selected.status]}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                  {REASON_LABELS[selected.reason] ?? selected.reason}
                </span>
              </div>
              <p className="text-base font-semibold leading-snug text-slate-950">
                {selected.subject}
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <a
                    href={`mailto:${selected.sender_email}`}
                    className="font-medium text-slate-950 underline-offset-4 hover:underline"
                  >
                    {selected.sender_email}
                  </a>
                  <CopyEmailButton email={selected.sender_email} />
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {formatDate(selected.created_at)}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono">{selected.id}</span>
                </div>
              </div>
            </div>

            {/* Message */}
            <div className="p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Message
              </p>
              <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {selected.message}
              </p>
            </div>

            {/* Update */}
            <div className="space-y-4 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Update
              </p>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Status
                </Label>
                <select
                  value={editStatus}
                  onChange={(e) => {
                    setEditStatus(e.target.value as InquiryStatus);
                    setSaveSuccess(false);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Admin notes{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => {
                    setEditNotes(e.target.value);
                    setSaveSuccess(false);
                  }}
                  placeholder="Internal notes…"
                  rows={3}
                  className="resize-none rounded-lg border-slate-200 text-sm"
                />
              </div>

              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              {saveSuccess && (
                <p className="text-sm text-slate-600">Changes saved.</p>
              )}

              <Button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="h-9 w-full rounded-lg bg-slate-950 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving…
                  </span>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Inquiries
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Contact form submissions — {total} total.
          </p>
        </div>
        <RefreshButton />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 sm:min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search ID, email, subject…"
            className="h-9 rounded-lg border-slate-200 pl-9 text-sm"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => navigate({ status: e.target.value, offset: "0" })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={filters.reason}
          onChange={(e) => navigate({ reason: e.target.value, offset: "0" })}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
        >
          <option value="">All reasons</option>
          {Object.entries(REASON_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) =>
              navigate({ dateFrom: e.target.value, offset: "0" })
            }
            title="From date"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => navigate({ dateTo: e.target.value, offset: "0" })}
            title="To date"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950"
          />
        </div>

        {hasFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({
                search: "",
                status: "",
                reason: "",
                dateFrom: "",
                dateTo: "",
                offset: "0",
              })
            }
            className="h-9 rounded-lg border-slate-200 px-3 text-sm"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Mobile: show list or detail */}
      <div className="lg:hidden">
        {showDetail && selected ? (
          <div className="space-y-3">
            <button
              onClick={() => setShowDetail(false)}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </button>
            <DetailPanel />
          </div>
        ) : (
          <ListPanel />
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_400px] lg:gap-4">
        <ListPanel />
        <DetailPanel />
      </div>
    </div>
  );
}
