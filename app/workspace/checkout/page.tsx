"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, CalendarDays, ArrowLeft, Loader2 } from "lucide-react";
import { useSubscription } from "@/lib/context/SubscriptionContext";

declare global {
  interface Window {
    // Cashfree JS SDK loaded dynamically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Cashfree?: any;
  }
}

async function loadCashfreeSDK() {
  if (typeof window === "undefined") return null;
  return new Promise<{ checkout: (opts: { paymentSessionId: string }) => void } | null>((resolve) => {
    const existing = document.getElementById("cashfree-sdk");
    const cfMode =
      process.env.NEXT_PUBLIC_CASHFREE_ENV === "production"
        ? "production"
        : process.env.NEXT_PUBLIC_CASHFREE_ENV === "sandbox"
        ? "sandbox"
        : process.env.NEXT_PUBLIC_BASE_URL?.includes("localhost")
        ? "sandbox"
        : "production";
    const onLoad = async () => {
      try {
        const { load } = await import("@cashfreepayments/cashfree-js");
        const cf = await load({ mode: cfMode });
        resolve(cf as unknown as { checkout: (opts: { paymentSessionId: string }) => void });
      } catch {
        resolve(null);
      }
    };
    if (existing) { void onLoad(); return; }
    const script = document.createElement("script");
    script.id = "cashfree-sdk";
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => void onLoad();
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("plan") as "monthly" | "quarterly" | null;
  const { data: subData } = useSubscription();
  const [loading, setLoading] = useState<"monthly" | "quarterly" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pre-load SDK
  useEffect(() => { void loadCashfreeSDK(); }, []);

  const handleSubscribe = async (plan: "monthly" | "quarterly") => {
    setLoading(plan);
    setError(null);
    try {
      const res = await fetch("/api/workspace/initiate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      const json = await res.json() as { ok: boolean; data?: { paymentSessionId: string }; error?: { message: string } };
      if (!res.ok || !json.ok) {
        setError(json.error?.message ?? "Failed to initiate payment. Please try again.");
        return;
      }
      const { paymentSessionId } = json.data!;
      const cf = await loadCashfreeSDK();
      if (!cf) {
        setError("Payment SDK failed to load. Please refresh and try again.");
        return;
      }
      cf.checkout({ paymentSessionId });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  // Auto-trigger if plan is preselected via URL
  useEffect(() => {
    if (preselected && !loading) {
      void handleSubscribe(preselected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected]);

  const statusLabel =
    subData?.plan === "trial"
      ? subData.daysLeft != null && subData.daysLeft > 0
        ? `Trial — ${subData.daysLeft} day${subData.daysLeft !== 1 ? "s" : ""} left`
        : "Trial expired"
      : subData?.plan === "subscribed"
      ? "Subscription active"
      : "Subscription expired";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Link>
      </div>

      <div className="mb-8 space-y-2">
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
          {statusLabel}
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Choose a plan
        </h1>
        <p className="text-sm leading-7 text-slate-600">
          Full access to receipts, approvals, exports, and your entire team under one subscription.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Monthly */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
            <Zap className="h-4 w-4 text-slate-700" />
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-950">Monthly</p>
          <div className="mt-1 flex items-end gap-1">
            <span className="text-4xl font-bold tracking-tight text-slate-950">₹999</span>
            <span className="mb-1 text-sm text-slate-500">/ month</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Full access, billed monthly. Cancel by not renewing.
          </p>
          <button
            type="button"
            onClick={() => void handleSubscribe("monthly")}
            disabled={loading !== null}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-950 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            {loading === "monthly" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening payment…
              </span>
            ) : (
              "Subscribe — ₹999"
            )}
          </button>
        </div>

        {/* Quarterly */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
          <span className="absolute -top-3 left-5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Save ₹298
          </span>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
            <CalendarDays className="h-4 w-4 text-slate-700" />
          </div>
          <p className="mt-4 text-lg font-semibold text-slate-950">Quarterly</p>
          <div className="mt-1 flex items-end gap-1">
            <span className="text-4xl font-bold tracking-tight text-slate-950">₹2,699</span>
            <span className="mb-1 text-sm text-slate-500">/ 3 months</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Three months upfront — best value.
          </p>
          <button
            type="button"
            onClick={() => void handleSubscribe("quarterly")}
            disabled={loading !== null}
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-slate-950 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            {loading === "quarterly" ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening payment…
              </span>
            ) : (
              "Subscribe — ₹2,699"
            )}
          </button>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Payments are processed securely by Cashfree.{" "}
        <Link href="/legal?scroll=refund#refund-policy" className="underline underline-offset-4 hover:text-slate-600">
          Refund policy
        </Link>
      </p>
    </div>
  );
}
