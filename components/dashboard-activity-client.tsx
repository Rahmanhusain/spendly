"use client";

import { useEffect, useState } from "react";
import { CircleAlert, FileText, FileUp } from "lucide-react";

type ActivityItem = {
  id: string;
  kind: "receipt" | "report" | "violation";
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  tone: "emerald" | "blue" | "amber" | "rose";
};

function toneClass(tone: ActivityItem["tone"]) {
  if (tone === "emerald") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (tone === "blue") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  if (tone === "rose") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-24 rounded-2xl border border-slate-200 bg-slate-50 animate-pulse"
        />
      ))}
    </div>
  );
}

export default function DashboardActivityClient({
  limit = 10,
}: {
  limit?: number;
}) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/dashboard/activity?limit=${limit}`, {
          signal: abortController.signal,
        });
        const payload = await response.json();

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error?.message || "Failed to load activity");
        }

        setItems(payload.data ?? []);
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to load activity",
        );
        setItems([]);
      }
    }

    void load();

    return () => abortController.abort();
  }, [limit]);

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (!items) {
    return <ActivitySkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        No recent activity yet. Upload a receipt or submit a report to populate
        the feed.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl border border-slate-200 px-4 py-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <span
                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClass(item.tone)}`}
              >
                {item.kind === "receipt" ? (
                  <FileUp className="h-4 w-4" />
                ) : item.kind === "report" ? (
                  <FileText className="h-4 w-4" />
                ) : (
                  <CircleAlert className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-950">
                  {item.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {item.detail}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Actor: {item.actor}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs text-slate-400">
              {formatTimestamp(item.timestamp)}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
