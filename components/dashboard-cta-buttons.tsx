"use client";

import Link from "next/link";
import { FileText, FileUp, CheckCircle2, BadgePlus, ArrowRight } from "lucide-react";
import { useSubscription } from "@/lib/context/SubscriptionContext";
import { DashboardExportButton } from "@/components/dashboard-export-button";

type Props = {
  canReview: boolean;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
};

export function DashboardCtaButtons({ canReview, dateRange, startDate, endDate }: Props) {
  const { isReadOnly } = useSubscription();

  const disabledClass = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-5 text-sm font-medium text-slate-400 opacity-60 cursor-not-allowed";
  const tooltip = "Renew your subscription to continue";

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {isReadOnly ? (
        <span title={tooltip} className={disabledClass}>
          <FileUp className="h-4 w-4" />
          Upload receipt
        </span>
      ) : (
        <Link
          href="/workspace/upload-receipt"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white shadow-lg shadow-slate-950/15 transition-transform hover:-translate-y-0.5 hover:bg-slate-900"
        >
          <FileUp className="h-4 w-4" />
          Upload receipt
        </Link>
      )}

      <Link
        href="/workspace/reports"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
      >
        <FileText className="h-4 w-4" />
        View reports
      </Link>

      {canReview ? (
        <Link
          href="/workspace/approvals"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          Review queue
        </Link>
      ) : (
        <Link
          href="/workspace/gst"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
        >
          <ArrowRight className="h-4 w-4" />
          GST workspace
        </Link>
      )}

      {canReview && (
        isReadOnly ? (
          <span title={tooltip} className={disabledClass}>
            <BadgePlus className="h-4 w-4" />
            Invite teammates
          </span>
        ) : (
          <Link
            href="/workspace/team-setup"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
          >
            <BadgePlus className="h-4 w-4" />
            Invite teammates
          </Link>
        )
      )}

      <DashboardExportButton
        dateRange={dateRange}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
