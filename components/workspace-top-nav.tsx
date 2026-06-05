"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  FileText,
  Receipt,
  RefreshCw,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/lib/context/SubscriptionContext";
import { SubscriptionExpiryModal } from "@/components/subscription-expiry-modal";

type WorkspaceTopNavProps = {
  orgName: string;
  tenantId: string;
  roleLabel: string;
  userLabel: string;
};

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
};

const MINI_TOAST_HIDE_AFTER_MS = 5000;
const MINI_TOAST_EXIT_MS = 300;
const OPEN_POLL_INTERVAL_MS = 10000;
const IDLE_POLL_INTERVAL_MS = 60000;

export function WorkspaceTopNav({
  orgName,
  tenantId,
  roleLabel,
  userLabel,
}: WorkspaceTopNavProps) {
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMiniToast, setShowMiniToast] = useState(false);
  const [isToastExiting, setIsToastExiting] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [isExpiryModalOpen, setIsExpiryModalOpen] = useState(false);
  const isNotificationsOpenRef = useRef(false);
  const isFetchingNotificationsRef = useRef(false);

  const { data: subData, isReadOnly } = useSubscription();

  // Auto-show expiry modal once per session when workspace is read-only
  useEffect(() => {
    if (isReadOnly && !sessionStorage.getItem("expiry_modal_shown")) {
      setIsExpiryModalOpen(true);
    }
  }, [isReadOnly]);

  const handleCloseExpiryModal = () => {
    sessionStorage.setItem("expiry_modal_shown", "1");
    setIsExpiryModalOpen(false);
  };

  const dismissMiniToast = () => {
    setIsToastExiting(true);
    window.setTimeout(() => {
      setShowMiniToast(false);
      setIsToastExiting(false);
    }, MINI_TOAST_EXIT_MS);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }

      if (
        notificationsMenuRef.current &&
        !notificationsMenuRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    isNotificationsOpenRef.current = isNotificationsOpen;
  }, [isNotificationsOpen]);

  const loadNotifications = async (options?: { withSpinner?: boolean }) => {
    if (isFetchingNotificationsRef.current) {
      return;
    }

    const withSpinner = options?.withSpinner ?? false;

    if (withSpinner) {
      setIsLoadingNotifications(true);
    }

    isFetchingNotificationsRef.current = true;

    try {
      const response = await fetch("/api/notifications?limit=10&offset=0", {
        method: "GET",
        credentials: "include",
      });
      const payload = (await response.json()) as NotificationsResponse;
      if (!response.ok || !payload.ok || !payload.data) {
        return;
      }

      setNotifications(payload.data.notifications);
      setUnreadCount(payload.data.unreadCount);

      const hasRejectedUnread = payload.data.notifications.some(
        (n) => !n.isRead && /reject/i.test(`${n.title} ${n.message}`),
      );

      if (hasRejectedUnread && !isNotificationsOpenRef.current) {
        setShowMiniToast(true);
        setIsToastExiting(false);
      }
    } catch {
      // Do not block layout for notification load issues.
    } finally {
      isFetchingNotificationsRef.current = false;
      if (withSpinner) {
        setIsLoadingNotifications(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const clearTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const schedule = () => {
      if (!active || document.visibilityState !== "visible") {
        return;
      }

      const interval = isNotificationsOpenRef.current
        ? OPEN_POLL_INTERVAL_MS
        : IDLE_POLL_INTERVAL_MS;

      timer = window.setTimeout(async () => {
        await loadNotifications();
        schedule();
      }, interval);
    };

    const refreshNow = async () => {
      clearTimer();
      await loadNotifications();
      schedule();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshNow();
      } else {
        clearTimer();
      }
    };

    const handleFocus = () => {
      void refreshNow();
    };

    void refreshNow();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (isNotificationsOpen) {
      void loadNotifications();
    }
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (!showMiniToast) {
      return;
    }

    const autoHideTimer = window.setTimeout(() => {
      dismissMiniToast();
    }, MINI_TOAST_HIDE_AFTER_MS);

    return () => {
      window.clearTimeout(autoHideTimer);
    };
  }, [showMiniToast]);

  const markAllNotificationsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ action: "mark_all_read" }),
      });

      setNotifications((current) =>
        current.map((n) => ({ ...n, isRead: true })),
      );
      setUnreadCount(0);
      setShowMiniToast(false);
      setIsToastExiting(false);
    } catch {
      // Silent fail, user can still use notifications panel.
    }
  };

  const formatNotificationTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getNotificationIcon = (relatedType: string | null) => {
    switch (relatedType) {
      case "receipt":
        return <Receipt className="h-3 w-3 text-red-600" />;
      case "expense_report":
        return <FileText className="h-3 w-3 text-blue-600" />;
      default:
        return <Bell className="h-3 w-3 text-slate-600" />;
    }
  };

  const handleOpenNotifications = async () => {
    const nextOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpen);
    if (nextOpen && unreadCount > 0) {
      await markAllNotificationsRead();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/workspace" className="flex items-center gap-3">
          <Image
            src="/logo/logo.png"
            alt="Spendly logo"
            width={180}
            height={42}
            className="h-8 w-auto"
            priority
          />
          <span className="hidden text-sm font-medium text-slate-600 sm:inline">
            {orgName}
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Subscription state indicator */}
          {!isReadOnly && subData?.plan === "trial" && (
            <Link
              href="/workspace/checkout"
              className="hidden items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition duration-150 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Subscribe
            </Link>
          )}
          {!isReadOnly && subData?.plan === "subscribed" && (
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 sm:inline-flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Subscribed
            </span>
          )}
          {isReadOnly && (
            <button
              type="button"
              onClick={() => setIsExpiryModalOpen(true)}
              className="hidden items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition duration-150 hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 sm:inline-flex"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Renew subscription
            </button>
          )}

          <div ref={notificationsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                void handleOpenNotifications();
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              aria-haspopup="menu"
              aria-expanded={isNotificationsOpen}
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-0 top-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">
                    Notifications
                  </p>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                    {unreadCount} unread
                  </Badge>
                </div>

                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      void loadNotifications({ withSpinner: true });
                    }}
                    disabled={isLoadingNotifications}
                    className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                    aria-label="Refresh notifications"
                  >
                    <RefreshCw
                      className={cn(
                        "h-3 w-3",
                        isLoadingNotifications && "animate-spin",
                      )}
                    />
                    <span>Refresh</span>
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600">
                    No notifications yet.
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {notifications.map((notification) => (
                      <article
                        key={notification.id}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {getNotificationIcon(notification.relatedType)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-900">
                              {notification.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                              {notification.message}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <p className="text-xs text-slate-400">
                                {formatNotificationTime(notification.createdAt)}
                              </p>
                              <div className="flex gap-1">
                                {notification.relatedType ===
                                  "expense_report" && notification.relatedId ? (
                                  <Link
                                    href={`/workspace/reports/${notification.relatedId}`}
                                    className="text-xs font-medium text-blue-600 underline underline-offset-4 hover:text-blue-700"
                                    onClick={() =>
                                      setIsNotificationsOpen(false)
                                    }
                                  >
                                    Open
                                  </Link>
                                ) : notification.relatedType === "receipt" ? (
                                  <Link
                                    href={
                                      notification.relatedId
                                        ? `/workspace/receipts/${notification.relatedId}`
                                        : "/workspace/receipts"
                                    }
                                    className="text-xs font-medium text-red-600 underline underline-offset-4 hover:text-red-700"
                                    onClick={() =>
                                      setIsNotificationsOpen(false)
                                    }
                                  >
                                    Open
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

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <Link
                    href="/workspace/notifications"
                    className="text-xs font-medium text-slate-700 underline underline-offset-4"
                    onClick={() => setIsNotificationsOpen(false)}
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-sm transition-colors",
                isProfileMenuOpen
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
              )}
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            {isProfileMenuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                <div className="rounded-xl bg-slate-950 px-4 py-4 text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white">
                      <User className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{userLabel}</p>
                      <p className="text-xs text-slate-300">{orgName}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex flex-wrap gap-2 px-1 pb-1">
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      Tenant: {tenantId.slice(0, 8)}...
                    </Badge>
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">
                      Role: {roleLabel}
                    </Badge>
                  </div>

                  <Link
                    href="/workspace/settings"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition-colors hover:bg-slate-50"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4 text-slate-500" />
                    Profile settings
                  </Link>
                  <Link
                    href="/workspace"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-slate-800 transition-colors hover:bg-slate-50"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <User className="h-4 w-4 text-slate-500" />
                    Open dashboard
                  </Link>
                  <div className="rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50">
                    <LogoutButton className="w-full justify-start border-0 bg-transparent p-0 text-left text-slate-800 shadow-none hover:bg-transparent" />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <SubscriptionExpiryModal
        open={isExpiryModalOpen}
        onClose={handleCloseExpiryModal}
      />

      {showMiniToast ? (
        <div
          className={cn(
            "fixed bottom-5 right-5 z-50 w-[min(92vw,360px)] rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-lg transition-all duration-300",
            isToastExiting
              ? "pointer-events-none translate-y-6 opacity-0"
              : "translate-y-0 opacity-100",
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-rose-900">
                Receipt rejected
              </p>
              <p className="mt-1 text-sm text-rose-800">See notification.</p>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-rose-900 underline underline-offset-4"
                onClick={() => {
                  setIsNotificationsOpen(true);
                  dismissMiniToast();
                  void markAllNotificationsRead();
                }}
              >
                Open notifications
              </button>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="text-rose-700"
              onClick={() => {
                dismissMiniToast();
              }}
            >
              <span className="text-sm">×</span>
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
