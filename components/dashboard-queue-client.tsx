"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

export type QueueItem = {
  id: string;
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  status: string;
  href: string;
};

type PaginationMeta = {
  limit: number;
  offset: number;
  total: number;
};

type ApiApproval = {
  approval: {
    id: string;
    reportId: string;
    currentLevel: number;
    totalLevels: number;
    createdAt: string;
  };
  report: {
    title: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  } | null;
  reportCreator: { id: string; name: string } | null;
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const PAGE_SIZE = 10;

type Props = {
  /** Initial items rendered server-side (first page) */
  initialItems: QueueItem[];
  /** True total from COUNT(*) — for showing "loaded X of Y" */
  total: number;
  /** If false (employee view), no more fetching — just show initial items */
  canLoadMore: boolean;
  queueLabel: string;
  isManager: boolean;
};

export default function DashboardQueueClient({
  initialItems,
  total,
  canLoadMore,
  queueLabel,
  isManager,
}: Props) {
  const [items, setItems] = useState<QueueItem[]>(initialItems);
  const [offset, setOffset] = useState(initialItems.length);
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(
    !canLoadMore || initialItems.length >= total,
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchMore = useCallback(async () => {
    if (loading || exhausted) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/approvals?limit=${PAGE_SIZE}&offset=${offset}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json() as { data: ApiApproval[]; pagination: PaginationMeta };

      const newItems: QueueItem[] = json.data.map((entry) => ({
        id: entry.approval.id,
        title: entry.report?.title ?? "Untitled report",
        detail: `${formatMoney(entry.report?.totalAmount ?? 0)} · level ${entry.approval.currentLevel}/${entry.approval.totalLevels}`,
        actor: entry.reportCreator?.name ?? "Unknown",
        timestamp: entry.approval.createdAt,
        status: "Awaiting approval",
        href: "/workspace/approvals",
      }));

      setItems((prev) => {
        // deduplicate by id
        const existingIds = new Set(prev.map((i) => i.id));
        const unique = newItems.filter((i) => !existingIds.has(i.id));
        return [...prev, ...unique];
      });

      const nextOffset = offset + json.data.length;
      setOffset(nextOffset);

      if (nextOffset >= json.pagination.total || json.data.length === 0) {
        setExhausted(true);
      }
    } catch {
      // silently fail — user can scroll again to retry
    } finally {
      setLoading(false);
    }
  }, [loading, exhausted, offset]);

  // IntersectionObserver to trigger load when sentinel is visible
  useEffect(() => {
    if (exhausted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchMore, exhausted]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Nothing in the queue right now.
      </div>
    );
  }

  return (
    <div className="max-h-170 md:max-h-160 overflow-y-auto space-y-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
              <p className="mt-2 text-xs text-slate-500">
                {item.actor} · {formatDateTime(item.timestamp)}
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
              {item.status}
            </span>
          </div>
        </Link>
      ))}

      {/* Sentinel — IntersectionObserver watches this */}
      {!exhausted && (
        <div ref={sentinelRef} className="py-2 text-center text-xs text-slate-400">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading more…
            </span>
          ) : (
            "Scroll to load more"
          )}
        </div>
      )}

      {exhausted && items.length > 0 && isManager && (
        <p className="text-center text-xs text-slate-400">
          {items.length} of {total} approval{total !== 1 ? "s" : ""} shown
        </p>
      )}
    </div>
  );
}
