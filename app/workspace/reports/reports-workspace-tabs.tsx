"use client";

import { useState } from "react";
import type { ExpenseReport } from "@/lib/repositories/reportRepository";
import type { ReceiptListItem } from "@/lib/repositories/receiptRepository";
import type { UserRecord } from "@/lib/repositories/authRepository";
import type { WorkspaceAuthContext } from "@/components/report-activity-panel";
import { ApprovalsWorkspace } from "../approvals/approvals-workspace";
import { ExpenseReportWorkspace } from "@/components/expense-report-workspace";

type Tab = "approvals" | "reports";

export function ReportsWorkspaceTabs({
  initialReports,
  initialReceiptsAvailable,
  initialHasMore,
  authContext,
  orgName,
  tenantUsers,
}: {
  initialReports: ExpenseReport[];
  initialReceiptsAvailable: ReceiptListItem[];
  initialHasMore: boolean;
  authContext: WorkspaceAuthContext;
  orgName: string;
  tenantUsers: UserRecord[];
}) {
  const canApprove =
    authContext.role === "manager" || authContext.role === "admin";

  const [tab, setTab] = useState<Tab>(canApprove ? "approvals" : "reports");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Reports
        </h1>

        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end sm:gap-2">
          <button
            type="button"
            onClick={() => setTab("reports")}
            aria-pressed={tab === "reports"}
            className={
              tab === "reports"
                ? "w-full rounded-xl border border-slate-900 bg-slate-950 px-3 py-2 text-sm font-medium text-white sm:w-auto"
                : "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
            }
          >
            Create/View reports
          </button>

          {canApprove ? (
            <button
              type="button"
              onClick={() => setTab("approvals")}
              aria-pressed={tab === "approvals"}
              className={
                tab === "approvals"
                  ? "w-full rounded-xl border border-slate-900 bg-slate-950 px-3 py-2 text-sm font-medium text-white sm:w-auto"
                  : "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
              }
            >
              Approvals
            </button>
          ) : null}
        </div>
      </div>

      {tab === "approvals" && canApprove ? (
        <ApprovalsWorkspace
          canApprove={canApprove}
          authContext={authContext}
          tenantUsers={tenantUsers}
        />
      ) : null}

      {tab === "reports" ? (
        <ExpenseReportWorkspace
          initialReports={initialReports}
          initialReceiptsAvailable={initialReceiptsAvailable}
          initialHasMore={initialHasMore}
          authContext={authContext}
          orgName={orgName}
          tenantUsers={tenantUsers}
        />
      ) : null}
    </div>
  );
}
