"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, FileText, Receipt } from "lucide-react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  ok: boolean;
  data?: {
    notifications: NotificationItem[];
    unreadCount: number;
  };
  error?: string;
};

type TabType = "all" | "receipts" | "reports";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getNotificationIcon(relatedType: string | null) {
  switch (relatedType) {
    case "receipt":
      return <Receipt className="h-4 w-4 text-red-600" />;
    case "expense_report":
      return <FileText className="h-4 w-4 text-blue-600" />;
    default:
      return <Bell className="h-4 w-4 text-slate-600" />;
  }
}

export default function NotificationsClient() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/notifications?limit=100&offset=0", {
          method: "GET",
          credentials: "include",
        });
        const payload = (await response.json()) as NotificationsResponse;
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || "Failed to load notifications");
        }
        if (!mounted) return;
        setItems(payload.data.notifications);
        setUnreadCount(payload.data.unreadCount);
      } catch (err) {
        if (!mounted) return;
        setError(
          err instanceof Error ? err.message : "Failed to load notifications",
        );
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case "receipts":
        return items.filter((item) => item.relatedType === "receipt");
      case "reports":
        return items.filter((item) => item.relatedType === "expense_report");
      default:
        return items;
    }
  }, [items, activeTab]);

  const tabCounts = useMemo(() => {
    const receipts = items.filter(
      (item) => item.relatedType === "receipt",
    ).length;
    const reports = items.filter(
      (item) => item.relatedType === "expense_report",
    ).length;
    return { receipts, reports, all: items.length };
  }, [items]);

  const title = useMemo(() => {
    if (unreadCount > 0) {
      return `Notifications (${unreadCount} unread)`;
    }
    return "Notifications";
  }, [unreadCount]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              See all in-app alerts and updates.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-6 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({tabCounts.all})
          </button>
          <button
            onClick={() => setActiveTab("receipts")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "receipts"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Receipts ({tabCounts.receipts})
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === "reports"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Reports ({tabCounts.reports})
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading notifications...</p>
        ) : error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-slate-600">
            {activeTab === "all"
              ? "No notifications yet."
              : `No ${activeTab} notifications yet.`}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((notification) => (
              <article
                key={notification.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getNotificationIcon(notification.relatedType)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {notification.message}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        {formatTime(notification.createdAt)}
                      </p>
                      <div className="flex items-center gap-2">
                        {notification.relatedType === "expense_report" &&
                        notification.relatedId ? (
                          <Link
                            href={`/workspace/reports/${notification.relatedId}`}
                            className="text-xs font-medium text-blue-600 underline underline-offset-4 hover:text-blue-700"
                          >
                            Open report
                          </Link>
                        ) : notification.relatedType === "receipt" &&
                          notification.relatedId ? (
                          <Link
                            href={`/workspace/receipts/${notification.relatedId}`}
                            className="text-xs font-medium text-red-600 underline underline-offset-4 hover:text-red-700"
                          >
                            Open receipt
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
