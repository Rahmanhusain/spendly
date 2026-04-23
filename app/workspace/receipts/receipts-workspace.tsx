"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Eye,
  Filter,
  MessageSquare,
  Search,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export function ReceiptsWorkspace({
  receipts,
}: {
  receipts: ReceiptListItem[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReceiptStatus>(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedReceiptId, setSelectedReceiptId] = useState(
    receipts[0]?.receiptId ?? "",
  );

  const categories = useMemo(() => {
    return ["all", ...new Set(receipts.map((row) => row.category))];
  }, [receipts]);

  const filteredReceipts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return receipts.filter((row) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        row.receiptId.toLowerCase().includes(normalizedQuery) ||
        row.vendor.toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" || row.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, query, receipts, statusFilter]);

  const selectedReceipt =
    filteredReceipts.find((row) => row.receiptId === selectedReceiptId) ??
    filteredReceipts[0] ??
    null;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          View all receipts
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Search by receipt ID, filter by category and status, then open any
          receipt for full details and comments.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_220px]">
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
      </section>

      <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-lg text-slate-950">
              Receipts ({filteredReceipts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[68vh] space-y-2 overflow-y-auto p-3">
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
                        <p className="text-sm font-semibold">{row.receiptId}</p>
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
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-lg text-slate-950">
              Receipt details
            </CardTitle>
          </CardHeader>
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
                      <div>
                        <Eye className="mx-auto h-6 w-6 text-slate-400" />
                        <p className="mt-2 text-sm font-medium text-slate-900">
                          {selectedReceipt.fileName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {selectedReceipt.mimeType}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        Receipt ID
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {selectedReceipt.receiptId}
                      </p>
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
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                      <User className="h-4 w-4 text-slate-500" /> Uploaded by
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {selectedReceipt.uploadedBy}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-2 text-xs text-slate-500">
                      <CalendarDays className="h-3.5 w-3.5" />{" "}
                      {selectedReceipt.uploadedAt}
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

                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                    <MessageSquare className="h-4 w-4 text-slate-500" />{" "}
                    Comments ({selectedReceipt.comments.length})
                  </p>
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
