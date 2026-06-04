"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Zap, CalendarDays } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SubscriptionExpiryModal({ open, onClose }: Props) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const go = (plan: "monthly" | "quarterly") => {
    onClose();
    router.push(`/workspace/checkout?plan=${plan}`);
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expiry-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 border border-rose-200">
          <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h2 id="expiry-modal-title" className="text-xl font-semibold text-slate-950">
          Your workspace is in read-only mode
        </h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Uploads, report creation, and exports are paused. Your existing data is safe.
          Choose a plan below to restore full access immediately.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => go("monthly")}
            className="flex flex-col items-start gap-1 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
              <Zap className="h-4 w-4 text-slate-700" />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-950">Monthly</p>
            <p className="text-lg font-bold text-slate-950">₹999</p>
            <p className="text-xs text-slate-500">per month</p>
          </button>

          <button
            type="button"
            onClick={() => go("quarterly")}
            className="relative flex flex-col items-start gap-1 rounded-xl border border-slate-900 bg-slate-950 p-4 text-left"
          >
            <span className="absolute -top-2.5 left-3 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              Save ₹298
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800">
              <CalendarDays className="h-4 w-4 text-slate-300" />
            </div>
            <p className="mt-2 text-sm font-semibold text-white">Quarterly</p>
            <p className="text-lg font-bold text-white">₹2,699</p>
            <p className="text-xs text-slate-400">per 3 months</p>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-slate-200 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
        >
          Continue in read-only mode
        </button>
      </div>
    </div>
  );
}
