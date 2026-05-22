import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { DateRangeSelector } from "@/components/date-range-selector";
import { SpendTimelineChart } from "@/components/spend-timeline-chart";
import { DashboardExportButton } from "@/components/dashboard-export-button";
import {
  loadDashboardData,
  type DashboardRole,
} from "@/lib/repositories/dashboardRepository";
import {
  Activity,
  ArrowRight,
  BadgePlus,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  FileUp,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import WorkspaceLoading from "./loading";
import type { AuthContext } from "@/lib/middleware/auth";

type SummaryCard = {
  label: string;
  value: string;
  note: string;
  icon: typeof TrendingUp;
  accent: string;
};

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCompactPercent(value: number | null) {
  if (value === null) {
    return "No previous month data";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}% vs last month`;
}

// ─── Data component — suspends while fetching ────────────────────────────────
async function DashboardData({
  authContext,
  dateRangeMode,
  customStartDate,
  customEndDate,
}: {
  authContext: AuthContext;
  dateRangeMode: "monthly" | "all-time" | "custom";
  customStartDate?: string;
  customEndDate?: string;
}) {
  const role = authContext.role as DashboardRole;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const canReview = role === "manager" || role === "admin";

  const tenantPromise = getTenantById(authContext.tenantId);
  const userPromise = getUserById(authContext.userId);
  const tenant = await tenantPromise;

  if (!tenant) {
    redirect("/api/auth/logout?next=/login");
  }

  const [user, dashboard] = await Promise.all([
    userPromise,
    loadDashboardData({
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      role,
      receiptQuotaMonthly: tenant.receipt_quota_monthly,
      trialEndsAt: tenant.trial_ends_at ?? null,
      dateRangeMode,
      customStartDate,
      customEndDate,
    }),
  ]);

  const displayName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
    : "Workspace user";

  // Dynamic labels based on date range mode
  const dateRangeLabel =
    dateRangeMode === "all-time"
      ? "All-time"
      : dateRangeMode === "custom"
        ? `${formatDateLabel(customStartDate ?? "")} - ${formatDateLabel(customEndDate ?? "")}`
        : "This month";

  const spendLabel =
    dateRangeMode === "all-time"
      ? "Total spend"
      : dateRangeMode === "custom"
        ? "Spend (selected range)"
        : "Spend this month";

  const receiptLabel =
    dateRangeMode === "all-time"
      ? "All receipts captured"
      : dateRangeMode === "custom"
        ? `Captured in selected range`
        : "Captured in the selected month";

  const avgReceiptLabel =
    dateRangeMode === "all-time"
      ? "Average ticket size (all-time)"
      : dateRangeMode === "custom"
        ? "Average ticket size (range)"
        : "Typical ticket size this month";

  const summaryCards: SummaryCard[] = [
    {
      label: spendLabel,
      value: formatMoney(dashboard.summary.currentSpend),
      note:
        dateRangeMode === "monthly"
          ? formatCompactPercent(dashboard.summary.monthOverMonthChange)
          : dateRangeLabel,
      icon: TrendingUp,
      accent: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Total tax",
      value: formatMoney(dashboard.summary.totalTax),
      note: `CGST + SGST + IGST (${dateRangeLabel})`,
      icon: CheckCircle2,
      accent: "bg-sky-50 text-sky-700",
    },
    {
      label: "Receipts",
      value: String(dashboard.summary.receiptCount),
      note: receiptLabel,
      icon: FileText,
      accent: "bg-violet-50 text-violet-700",
    },
    {
      label: "Average receipt",
      value: formatMoney(dashboard.summary.averageReceipt),
      note: avgReceiptLabel,
      icon: Activity,
      accent: "bg-slate-50 text-slate-700",
    },
    {
      label: "Open reports",
      value: String(dashboard.summary.openReports),
      note: canReview
        ? `Waiting in workflow (${dateRangeLabel})`
        : `Your drafts and submissions (${dateRangeLabel})`,
      icon: FileUp,
      accent: "bg-amber-50 text-amber-700",
    },
    {
      label: canReview ? "Pending approvals" : "Review queue",
      value: String(dashboard.summary.reviewQueue),
      note: canReview
        ? `Manager queue (${dateRangeLabel})`
        : `Reports waiting (${dateRangeLabel})`,
      icon: Clock3,
      accent: "bg-orange-50 text-orange-700",
    },
    {
      label: "Policy issues",
      value: String(dashboard.summary.policyIssues),
      note: `${dashboard.summary.duplicateReceipts} duplicate receipt(s) (${dateRangeLabel})`,
      icon: CircleAlert,
      accent:
        dashboard.summary.policyIssues > 0
          ? "bg-rose-50 text-rose-700"
          : "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Receipts remaining",
      value: String(dashboard.summary.receiptQuotaRemaining),
      note: "Against the monthly workspace quota",
      icon: Users,
      accent: "bg-cyan-50 text-cyan-700",
    },
  ];

  const piePalette = [
    "#0f172a",
    "#10b981",
    "#0ea5e9",
    "#8b5cf6",
    "#f97316",
    "#14b8a6",
  ];
  const categorySpendTotal = dashboard.categories.reduce(
    (sum, category) => sum + category.amount,
    0,
  );

  const categoryPieRows = [
    ...dashboard.categories.map((category, index) => ({
      label: category.category,
      amount: category.amount,
      count: category.count,
      tax: category.tax,
      share:
        categorySpendTotal > 0
          ? (category.amount / categorySpendTotal) * 100
          : 0,
      color: piePalette[index % piePalette.length],
    })),
  ];

  let pieCursor = 0;
  const pieSegments = categoryPieRows
    .map((row) => {
      const safeShare = Math.max(0, Math.min(100 - pieCursor, row.share));
      const start = pieCursor;
      const end = pieCursor + safeShare;
      pieCursor = end;

      return {
        ...row,
        start,
        end,
      };
    })
    .filter((segment) => segment.end > segment.start);

  const pieBackground =
    pieSegments.length > 0
      ? `conic-gradient(${pieSegments
          .map(
            (segment) =>
              `${segment.color} ${segment.start.toFixed(2)}% ${segment.end.toFixed(2)}%`,
          )
          .join(", ")})`
      : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_30%)]" />
          <div className="relative grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
            <div>
              <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-700">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Live workspace dashboard
              </Badge>
              <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
                Welcome back, {displayName || "there"}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {tenant.name} · {roleLabel} access · Tenant ID{" "}
                {authContext.tenantId}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/workspace/upload-receipt"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-medium text-white shadow-lg shadow-slate-950/15 transition-transform hover:-translate-y-0.5 hover:bg-slate-900"
                >
                  <FileUp className="h-4 w-4" />
                  Upload receipt
                </Link>
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
                {canReview ? (
                  <Link
                    href="/team-setup"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                  >
                    <BadgePlus className="h-4 w-4" />
                    Invite teammates
                  </Link>
                ) : null}
                <DashboardExportButton
                  dateRange={dateRangeMode}
                  startDate={customStartDate}
                  endDate={customEndDate}
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-200/80 bg-white/90 p-4 backdrop-blur-sm">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Workspace pulse
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {dashboard.summary.trialDaysLeft === null
                    ? "Trial status unavailable"
                    : dashboard.summary.trialDaysLeft === 0
                      ? "Trial ends today"
                      : `${dashboard.summary.trialDaysLeft} trial day(s) left`}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {dashboard.summary.receiptQuotaRemaining} receipt slots remain
                  in the current monthly quota.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  [
                    "Current spend",
                    formatMoney(dashboard.summary.currentSpend),
                  ],
                  ["Open issues", String(dashboard.summary.policyIssues)],
                  ["Review queue", String(dashboard.summary.reviewQueue)],
                  ["Tax collected", formatMoney(dashboard.summary.totalTax)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      {label}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Date Range Selector */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filter by date range</CardTitle>
          </CardHeader>
          <CardContent>
            <DateRangeSelector />
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card
                key={metric.label}
                className="overflow-hidden border-slate-200 shadow-sm"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardDescription>{metric.label}</CardDescription>
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${metric.accent}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <CardTitle className="text-3xl tracking-tight text-slate-950">
                    {metric.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {metric.note}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] w-full min-w-0">
          <Card className="border-slate-200 shadow-sm flex min-w-0 flex-col min-h-100 w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <TrendingUp className="h-5 w-5 text-slate-500" />
                Spend timeline
              </CardTitle>
              <CardDescription className="text-xs">
                Trend line view for {dateRangeLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-w-0 space-y-3 w-full max-w-full">
              {dashboard.trend.length > 0 ? (
                <SpendTimelineChart points={dashboard.trend} />
              ) : (
                <div className="flex min-h-55 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                  No trend data for this period
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm flex min-w-0 flex-col min-h-100 w-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <Activity className="h-5 w-5 text-slate-500" />
                Spend by category
              </CardTitle>
              <CardDescription className="text-xs">
                Category split for {dateRangeLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center overflow-y-auto space-y-3 w-full min-w-0">
              {dashboard.categories.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                  <div className="flex items-center justify-center">
                    <div
                      className="relative h-48 w-48 rounded-full border border-slate-200 shadow-sm"
                      style={{ background: pieBackground }}
                    >
                      <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full border border-slate-200 bg-white text-center">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                          Total
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {formatMoney(categorySpendTotal)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {categoryPieRows.map((row) => (
                      <div
                        key={row.label}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: row.color }}
                              />
                              <span className="truncate">{row.label}</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {row.count > 0
                                ? `${row.count} receipt(s) · `
                                : ""}
                              {row.share.toFixed(1)}% share
                            </p>
                          </div>
                          <p className="whitespace-nowrap text-sm font-medium text-slate-700">
                            {formatMoney(row.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-600 text-center">
                  No spending categories yet for this period.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <Clock3 className="h-5 w-5 text-slate-500" />
                Recent activity
              </CardTitle>
              <CardDescription>
                Latest receipts, reports, and compliance events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-130 overflow-y-auto pr-1">
              {dashboard.activity.length > 0 ? (
                dashboard.activity.slice(0, 10).map((item) => {
                  const toneClass =
                    item.tone === "emerald"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : item.tone === "blue"
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : item.tone === "rose"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-amber-200 bg-amber-50 text-amber-700";

                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                          <span
                            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toneClass}`}
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
                          {formatDateTime(item.timestamp)}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  No recent activity yet. Upload a receipt or submit a report to
                  populate the feed.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                  <CheckCircle2 className="h-5 w-5 text-slate-500" />
                  {dashboard.queueLabel}
                </CardTitle>
                <CardDescription>
                  {canReview
                    ? "Pending approvals with the newest requests first."
                    : "Your latest reports and their current status."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.queueItems.length > 0 ? (
                  dashboard.queueItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="block rounded-2xl border border-slate-200 px-4 py-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-950">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {item.detail}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            {item.actor} · {formatDateTime(item.timestamp)}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                          {item.status}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    Nothing in the queue right now.
                  </div>
                )}
              </CardContent>
            </Card>

            {canReview ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                    <Users className="h-5 w-5 text-slate-500" />
                    Top contributors
                  </CardTitle>
                  <CardDescription>
                    Spend by teammate for {dateRangeLabel}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dashboard.topContributors.length > 0 ? (
                    dashboard.topContributors.map((person, index) => (
                      <div
                        key={`${person.name}-${index}`}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-950">
                            {person.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {person.receiptCount} receipt(s) captured
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatMoney(person.totalSpend)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                      No contributor data yet for this period.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                    <CircleAlert className="h-5 w-5 text-slate-500" />
                    Compliance snapshot
                  </CardTitle>
                  <CardDescription>
                    Keep an eye on what needs attention for {dateRangeLabel}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-700">
                  <p>
                    {dashboard.summary.policyIssues} unresolved policy issue(s).
                  </p>
                  <p>
                    {dashboard.summary.duplicateReceipts} duplicate receipt(s)
                    flagged.
                  </p>
                  <p>
                    {dashboard.summary.reviewQueue} report(s) waiting in your
                    queue.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <Sparkles className="h-5 w-5 text-slate-500" />
                Quick actions
              </CardTitle>
              <CardDescription>
                Shortcuts for the most common workflow steps
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                ["Upload receipt", "/workspace/upload-receipt"],
                ["View receipts", "/workspace/receipts"],
                ["Open reports", "/workspace/reports"],
                ["GST workspace", "/workspace/gst"],
                ...(canReview
                  ? [["Review approvals", "/workspace/approvals"]]
                  : []),
              ].map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
                >
                  <span>{label}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
                <TrendingDown className="h-5 w-5 text-slate-500" />
                Workspace signals
              </CardTitle>
              <CardDescription>
                A compact operational view for {dateRangeLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                ["Spend", formatMoney(dashboard.summary.currentSpend)],
                ["Tax collected", formatMoney(dashboard.summary.totalTax)],
                ["Open reports", String(dashboard.summary.openReports)],
                ["Policy issues", String(dashboard.summary.policyIssues)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    {label}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    {value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* <ScrollIndicator /> */}
    </>
  );
}

// ─── Page — auth only, renders instantly ─────────────────────────────────────
export default async function WorkspacePage(props: {
  searchParams?: Promise<{
    dateRange?: string;
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const dateRangeMode =
    (searchParams?.dateRange as "monthly" | "all-time" | "custom") || "monthly";
  const customStartDate = searchParams?.startDate;
  const customEndDate = searchParams?.endDate;

  const authContext = await getServerAuthContext();

  if (!authContext) {
    redirect("/api/auth/logout?next=/login");
  }

  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <DashboardData
        authContext={authContext}
        dateRangeMode={dateRangeMode}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
      />
    </Suspense>
  );
}
