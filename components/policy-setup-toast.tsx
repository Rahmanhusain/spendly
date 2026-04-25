"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";

const TOAST_HIDE_AFTER_MS = 6000;
const TOAST_EXIT_ANIMATION_MS = 350;
const SESSION_KEY = "spendly-policy-setup-toast-seen";

export function PolicySetupToast() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let isActive = true;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    async function loadPolicyState() {
      if (typeof window === "undefined") {
        return;
      }

      const seen = window.sessionStorage.getItem(SESSION_KEY) === "1";
      if (seen) {
        return;
      }

      try {
        const response = await fetch("/api/policies", {
          method: "GET",
          credentials: "include",
        });

        const result = (await response.json()) as {
          ok?: boolean;
          data?: { hasPolicy?: boolean };
        };

        if (!isActive) {
          return;
        }

        const hasPolicy = Boolean(result?.ok && result?.data?.hasPolicy);

        if (!hasPolicy) {
          setMounted(true);
          // Next frame ensures transition from enter to visible.
          requestAnimationFrame(() => {
            if (isActive) {
              setVisible(true);
            }
          });

          hideTimer = setTimeout(() => {
            setVisible(false);
            window.sessionStorage.setItem(SESSION_KEY, "1");
          }, TOAST_HIDE_AFTER_MS);
        }
      } catch {
        // Silent fail: policy warning should never block page behavior.
      }
    }

    loadPolicyState();

    return () => {
      isActive = false;
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (!mounted || visible) {
      return;
    }

    const timer = setTimeout(() => {
      setMounted(false);
    }, TOAST_EXIT_ANIMATION_MS);

    return () => clearTimeout(timer);
  }, [mounted, visible]);

  const classes = useMemo(() => {
    const base =
      "fixed bottom-5 right-5 z-50 w-[min(92vw,360px)] rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-lg transition-all duration-300";

    if (visible) {
      return `${base} translate-y-0 opacity-100`;
    }

    return `${base} pointer-events-none translate-y-6 opacity-0`;
  }, [visible]);

  if (!mounted) {
    return null;
  }

  return (
    <div className={classes} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-900">
            Policy setup recommended
          </p>
          <p className="text-sm leading-5 text-amber-800">
            No active expense policy found. Set up a policy to enable warning
            checks on receipts.
          </p>
        </div>
      </div>
    </div>
  );
}
