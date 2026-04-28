"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

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

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        {loading ? (
          <p className="text-sm text-slate-600">Loading notifications...</p>
        ) : error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-600">No notifications yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((notification) => (
              <article
                key={notification.id}
                className="rounded-xl border border-slate-200 p-4"
              >
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
                  {notification.relatedType === "expense_report" &&
                  notification.relatedId ? (
                    <Link
                      href="/workspace/approvals"
                      className="text-xs font-medium text-slate-700 underline underline-offset-4"
                    >
                      Open approvals
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
