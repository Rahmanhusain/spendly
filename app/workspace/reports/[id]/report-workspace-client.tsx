"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ReportActivityPanel,
  type WorkspaceAuthContext,
} from "@/components/report-activity-panel";
import type { ExpenseReport } from "@/lib/repositories/reportRepository";
import type { UserRecord } from "@/lib/repositories/authRepository";

export function ReportWorkspaceClient({
  initialReport,
  reportItemsCount,
  authContext,
  tenantUsers,
}: {
  initialReport: ExpenseReport;
  reportItemsCount: number;
  authContext: WorkspaceAuthContext;
  tenantUsers: UserRecord[];
}) {
  const [report, setReport] = useState(initialReport);

  const handleReportUpdated = useCallback((updated: ExpenseReport) => {
    setReport(updated);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/workspace/reports"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to reports
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {report.title}
        </h1>
      </div>

      <ReportActivityPanel
        report={report}
        reportItemsCount={reportItemsCount}
        authContext={authContext}
        tenantUsers={tenantUsers}
        onReportUpdated={handleReportUpdated}
      />
    </div>
  );
}

