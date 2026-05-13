import Link from "next/link";
import { redirect } from "next/navigation";
import { query } from "@/lib/db/client";
import { getServerAuthContext } from "@/lib/middleware/auth";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { getReportsForTenant } from "@/lib/repositories/reportRepository";
import { DateRangeSelector } from "@/components/date-range-selector";
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

type DashboardRole = "employee" | "manager" | "admin";

type SummaryCard = {
  label: string;
  value: string;
  note: string;
  icon: typeof TrendingUp;
  accent: string;
};

type TrendPoint = {
  date: string;
  label: string;
  amount: number;
  tax: number;
  receipts: number;
};

type CategoryRow = {
  category: string;
  amount: number;
  tax: number;
  count: number;
  share: number;
};

type ActivityItem = {
  id: string;
  kind: "receipt" | "report" | "violation";
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  tone: "emerald" | "blue" | "amber" | "rose";
};

type QueueItem = {
  id: string;
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
  status: string;
  href: string;
};

type ContributorRow = {
  name: string;
  totalSpend: number;
  receiptCount: number;
};

type DashboardData = {
  summary: {
    currentSpend: number;
    previousSpend: number;
    totalTax: number;
    receiptCount: number;
    averageReceipt: number;
    openReports: number;
    reviewQueue: number;
    policyIssues: number;
    duplicateReceipts: number;
    monthOverMonthChange: number | null;
    receiptQuotaRemaining: number;
    trialDaysLeft: number | null;
  };
  trend: TrendPoint[];
  categories: CategoryRow[];
  activity: ActivityItem[];
  queueItems: QueueItem[];
  queueLabel: string;
  topContributors: ContributorRow[];
  maxTrendValue: number;
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

function formatCompactPercent(value: number | null) {
  if (value === null) {
    return "No previous month data";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}% vs last month`;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shiftDays(value: Date, days: number) {
  const shifted = new Date(value);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function getMonthWindow(reference: Date) {
  return {
    start: dateKey(new Date(reference.getFullYear(), reference.getMonth(), 1)),
    endExclusive: dateKey(
      new Date(reference.getFullYear(), reference.getMonth() + 1, 1),
    ),
  };
}

function getRollingWindow(days: number) {
  const end = new Date();
  const start = shiftDays(end, -(days - 1));
  return {
    start: dateKey(start),
    end: dateKey(end),
  };
}

function buildTrendSeries(
  startDate: string,
  endDate: string,
  rows: Array<{ day: string; amount: string; tax: string; receipts: string }>,
): TrendPoint[] {
  const rowMap = new Map(rows.map((row) => [row.day, row]));
  const points: TrendPoint[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  let index = 0;
  while (start <= end) {
    const key = dateKey(start);
    const row = rowMap.get(key);
    points.push({
      date: key,
      label:
        index % 5 === 0 || key === endDate
          ? start.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })
          : "",
      amount: Number(row?.amount ?? 0),
      tax: Number(row?.tax ?? 0),
      receipts: Number(row?.receipts ?? 0),
    });

    start.setDate(start.getDate() + 1);
    index += 1;
  }

  return points;
}

function calculateTrialDaysLeft(trialEndsAt: string | null | undefined) {
  if (!trialEndsAt) {
    return null;
  }

  const diff = new Date(trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function loadDashboardData(input: {
  tenantId: string;
  userId: string;
  role: DashboardRole;
  receiptQuotaMonthly: number;
  trialEndsAt: string | null;
  dateRangeMode?: "monthly" | "all-time" | "custom";
  customStartDate?: string;
  customEndDate?: string;
}): Promise<DashboardData> {
  const {
    tenantId,
    userId,
    role,
    receiptQuotaMonthly,
    trialEndsAt,
    dateRangeMode = "monthly",
    customStartDate,
    customEndDate,
  } = input;
  const isEmployee = role === "employee";
  const canReview = role === "manager" || role === "admin";

  const now = new Date();

  // Determine date windows based on mode
  let currentMonth, previousMonth, trendWindow;

  if (dateRangeMode === "all-time") {
    // All-time: from 2000-01-01 to today
    currentMonth = {
      start: "2000-01-01",
      endExclusive: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
    };
    previousMonth = {
      start: "2000-01-01",
      endExclusive: currentMonth.start,
    };
    trendWindow = {
      start: "2000-01-01",
      end: dateKey(now),
    };
  } else if (dateRangeMode === "custom" && customStartDate && customEndDate) {
    // Custom date range
    const endDateObj = new Date(customEndDate);
    endDateObj.setDate(endDateObj.getDate() + 1); // Include the end date
    currentMonth = {
      start: customStartDate,
      endExclusive: dateKey(endDateObj),
    };
    previousMonth = {
      start: "2000-01-01",
      endExclusive: customStartDate,
    };
    trendWindow = {
      start: customStartDate,
      end: customEndDate,
    };
  } else {
    // Monthly (default)
    currentMonth = getMonthWindow(now);
    previousMonth = getMonthWindow(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    );
    trendWindow = getRollingWindow(29);
  }

  const currentMonthSummaryPromise = query<{
    receipt_count: string;
    total_spend: string;
    total_tax: string;
    duplicate_count: string;
  }>(
    isEmployee
      ? `SELECT
          COUNT(*)::text AS receipt_count,
          COALESCE(SUM(r.amount), 0)::text AS total_spend,
          COALESCE(SUM(COALESCE(r.tax_amount, 0)), 0)::text AS total_tax,
          COUNT(*) FILTER (WHERE r.is_duplicate)::text AS duplicate_count
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.user_id = $2
          AND r.receipt_date >= $3::date
          AND r.receipt_date < $4::date`
      : `SELECT
          COUNT(*)::text AS receipt_count,
          COALESCE(SUM(r.amount), 0)::text AS total_spend,
          COALESCE(SUM(COALESCE(r.tax_amount, 0)), 0)::text AS total_tax,
          COUNT(*) FILTER (WHERE r.is_duplicate)::text AS duplicate_count
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.receipt_date >= $2::date
          AND r.receipt_date < $3::date`,
    isEmployee
      ? [tenantId, userId, currentMonth.start, currentMonth.endExclusive]
      : [tenantId, currentMonth.start, currentMonth.endExclusive],
  );

  const previousMonthSummaryPromise = query<{
    total_spend: string;
  }>(
    isEmployee
      ? `SELECT COALESCE(SUM(r.amount), 0)::text AS total_spend
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.user_id = $2
          AND r.receipt_date >= $3::date
          AND r.receipt_date < $4::date`
      : `SELECT COALESCE(SUM(r.amount), 0)::text AS total_spend
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.receipt_date >= $2::date
          AND r.receipt_date < $3::date`,
    isEmployee
      ? [tenantId, userId, previousMonth.start, previousMonth.endExclusive]
      : [tenantId, previousMonth.start, previousMonth.endExclusive],
  );

  const trendRowsPromise = query<{
    day: string;
    amount: string;
    tax: string;
    receipts: string;
  }>(
    isEmployee
      ? `SELECT
          r.receipt_date::text AS day,
          COALESCE(SUM(r.amount), 0)::text AS amount,
          COALESCE(SUM(COALESCE(r.tax_amount, 0)), 0)::text AS tax,
          COUNT(*)::text AS receipts
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.user_id = $2
          AND r.receipt_date >= $3::date
          AND r.receipt_date <= $4::date
        GROUP BY 1
        ORDER BY 1`
      : `SELECT
          r.receipt_date::text AS day,
          COALESCE(SUM(r.amount), 0)::text AS amount,
          COALESCE(SUM(COALESCE(r.tax_amount, 0)), 0)::text AS tax,
          COUNT(*)::text AS receipts
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.receipt_date >= $2::date
          AND r.receipt_date <= $3::date
        GROUP BY 1
        ORDER BY 1`,
    isEmployee
      ? [tenantId, userId, trendWindow.start, trendWindow.end]
      : [tenantId, trendWindow.start, trendWindow.end],
  );

  const categoryRowsPromise = query<{
    category: string;
    amount: string;
    tax: string;
    count: string;
  }>(
    isEmployee
      ? `SELECT
          COALESCE(r.category, 'Uncategorized') AS category,
          COALESCE(SUM(r.amount), 0)::text AS amount,
          COALESCE(SUM(COALESCE(r.tax_amount, 0)), 0)::text AS tax,
          COUNT(*)::text AS count
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.user_id = $2
          AND r.receipt_date >= $3::date
          AND r.receipt_date < $4::date
        GROUP BY 1
        ORDER BY COALESCE(SUM(r.amount), 0) DESC
        LIMIT 6`
      : `SELECT
          COALESCE(r.category, 'Uncategorized') AS category,
          COALESCE(SUM(r.amount), 0)::text AS amount,
          COALESCE(SUM(COALESCE(r.tax_amount, 0)), 0)::text AS tax,
          COUNT(*)::text AS count
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.receipt_date >= $2::date
          AND r.receipt_date < $3::date
        GROUP BY 1
        ORDER BY COALESCE(SUM(r.amount), 0) DESC
        LIMIT 6`,
    isEmployee
      ? [tenantId, userId, currentMonth.start, currentMonth.endExclusive]
      : [tenantId, currentMonth.start, currentMonth.endExclusive],
  );

  const recentReceiptsPromise = query<{
    id: string;
    vendor_name: string | null;
    amount: string;
    status: string;
    receipt_date: string;
    created_at: string;
    actor_name: string;
    category: string | null;
  }>(
    isEmployee
      ? `SELECT
          r.id,
          r.vendor_name,
          r.amount::text AS amount,
          r.status,
          r.receipt_date::text AS receipt_date,
          r.created_at::text AS created_at,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS actor_name,
          r.category
        FROM receipts r
        JOIN users u ON u.id = r.user_id
        WHERE r.tenant_id = $1
          AND r.user_id = $2
        ORDER BY r.created_at DESC
        LIMIT 5`
      : `SELECT
          r.id,
          r.vendor_name,
          r.amount::text AS amount,
          r.status,
          r.receipt_date::text AS receipt_date,
          r.created_at::text AS created_at,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS actor_name,
          r.category
        FROM receipts r
        JOIN users u ON u.id = r.user_id
        WHERE r.tenant_id = $1
        ORDER BY r.created_at DESC
        LIMIT 5`,
    isEmployee ? [tenantId, userId] : [tenantId],
  );

  const recentReportsPromise = getReportsForTenant(tenantId, {
    limit: 5,
    userId: isEmployee ? userId : undefined,
    status: "all",
  });

  const openReportsPromise = query<{ count: string }>(
    isEmployee
      ? `SELECT COUNT(*)::text AS count
         FROM expense_reports er
         WHERE er.tenant_id = $1
           AND er.user_id = $2
           AND er.status IN ('draft', 'submitted', 'info_requested')`
      : `SELECT COUNT(*)::text AS count
         FROM expense_reports er
         WHERE er.tenant_id = $1
           AND er.status IN ('draft', 'submitted', 'info_requested')`,
    isEmployee ? [tenantId, userId] : [tenantId],
  );

  const policyIssuesPromise = query<{ count: string }>(
    isEmployee
      ? `SELECT COUNT(*)::text AS count
         FROM policy_violations pv
         LEFT JOIN receipts r ON r.id = pv.receipt_id
         WHERE pv.tenant_id = $1
           AND pv.resolved = FALSE
           AND r.user_id = $2`
      : `SELECT COUNT(*)::text AS count
         FROM policy_violations pv
         WHERE pv.tenant_id = $1
           AND pv.resolved = FALSE`,
    isEmployee ? [tenantId, userId] : [tenantId],
  );

  const recentPolicyIssuesPromise = query<{
    id: string;
    rule_code: string;
    message: string;
    severity: string;
    created_at: string;
    receipt_vendor: string | null;
    owner_name: string | null;
  }>(
    isEmployee
      ? `SELECT
          pv.id,
          pv.rule_code,
          pv.message,
          pv.severity,
          pv.created_at::text AS created_at,
          COALESCE(r.vendor_name, 'Receipt') AS receipt_vendor,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS owner_name
        FROM policy_violations pv
        LEFT JOIN receipts r ON r.id = pv.receipt_id
        LEFT JOIN users u ON u.id = r.user_id
        WHERE pv.tenant_id = $1
          AND pv.resolved = FALSE
          AND r.user_id = $2
        ORDER BY pv.created_at DESC
        LIMIT 4`
      : `SELECT
          pv.id,
          pv.rule_code,
          pv.message,
          pv.severity,
          pv.created_at::text AS created_at,
          COALESCE(r.vendor_name, 'Receipt') AS receipt_vendor,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS owner_name
        FROM policy_violations pv
        LEFT JOIN receipts r ON r.id = pv.receipt_id
        LEFT JOIN users u ON u.id = r.user_id
        WHERE pv.tenant_id = $1
          AND pv.resolved = FALSE
        ORDER BY pv.created_at DESC
        LIMIT 4`,
    isEmployee ? [tenantId, userId] : [tenantId],
  );

  const pendingApprovalsPromise = canReview
    ? query<{
        id: string;
        report_id: string;
        report_title: string;
        requester_name: string;
        total_amount: string;
        created_at: string;
        current_level: number;
        total_levels: number;
      }>(
        `SELECT
          aw.id,
          aw.report_id,
          er.title AS report_title,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS requester_name,
          er.total_amount::text AS total_amount,
          aw.created_at::text AS created_at,
          aw.current_level,
          aw.total_levels
        FROM approval_workflows aw
        JOIN expense_reports er ON er.id = aw.report_id AND er.tenant_id = aw.tenant_id
        LEFT JOIN users u ON u.id = er.user_id
        WHERE aw.tenant_id = $1
          AND aw.status = 'submitted'
        ORDER BY aw.created_at DESC
        LIMIT 5`,
        [tenantId],
      )
    : Promise.resolve({
        rows: [] as Array<{
          id: string;
          report_id: string;
          report_title: string;
          requester_name: string;
          total_amount: string;
          created_at: string;
          current_level: number;
          total_levels: number;
        }>,
      });

  const contributorRowsPromise = canReview
    ? query<{
        name: string;
        total_spend: string;
        receipt_count: string;
      }>(
        `SELECT
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS name,
          COALESCE(SUM(r.amount), 0)::text AS total_spend,
          COUNT(*)::text AS receipt_count
        FROM receipts r
        JOIN users u ON u.id = r.user_id
        WHERE r.tenant_id = $1
          AND r.receipt_date >= $2::date
          AND r.receipt_date < $3::date
        GROUP BY 1
        ORDER BY COALESCE(SUM(r.amount), 0) DESC
        LIMIT 3`,
        [tenantId, currentMonth.start, currentMonth.endExclusive],
      )
    : Promise.resolve({
        rows: [] as Array<{
          name: string;
          total_spend: string;
          receipt_count: string;
        }>,
      });

  const [
    currentMonthSummary,
    previousMonthSummary,
    trendRows,
    categoryRows,
    recentReceipts,
    recentReports,
    openReportsRow,
    policyIssuesRow,
    recentPolicyIssues,
    pendingApprovalsResult,
    contributorRows,
  ] = await Promise.all([
    currentMonthSummaryPromise,
    previousMonthSummaryPromise,
    trendRowsPromise,
    categoryRowsPromise,
    recentReceiptsPromise,
    recentReportsPromise,
    openReportsPromise,
    policyIssuesPromise,
    recentPolicyIssuesPromise,
    pendingApprovalsPromise,
    contributorRowsPromise,
  ]);

  const currentSpend = Number(currentMonthSummary.rows[0]?.total_spend ?? 0);
  const previousSpend = Number(previousMonthSummary.rows[0]?.total_spend ?? 0);
  const receiptCount = Number(currentMonthSummary.rows[0]?.receipt_count ?? 0);
  const totalTax = Number(currentMonthSummary.rows[0]?.total_tax ?? 0);
  const duplicateReceipts = Number(
    currentMonthSummary.rows[0]?.duplicate_count ?? 0,
  );
  const openReports = Number(openReportsRow.rows[0]?.count ?? 0);
  const policyIssues = Number(policyIssuesRow.rows[0]?.count ?? 0);
  const reviewQueue = canReview
    ? Number(pendingApprovalsResult.rows.length)
    : openReports;
  const averageReceipt = receiptCount > 0 ? currentSpend / receiptCount : 0;
  const monthOverMonthChange =
    previousSpend > 0
      ? ((currentSpend - previousSpend) / previousSpend) * 100
      : null;
  const receiptQuotaRemaining = Math.max(0, receiptQuotaMonthly - receiptCount);
  const trialDaysLeft = calculateTrialDaysLeft(trialEndsAt);

  const trend = buildTrendSeries(
    trendWindow.start,
    trendWindow.end,
    trendRows.rows,
  );
  const maxTrendValue = Math.max(0, ...trend.map((point) => point.amount));

  const categories = categoryRows.rows.map((row) => ({
    category: row.category,
    amount: Number(row.amount ?? 0),
    tax: Number(row.tax ?? 0),
    count: Number(row.count ?? 0),
    share:
      currentSpend > 0 ? (Number(row.amount ?? 0) / currentSpend) * 100 : 0,
  }));

  const recentReportItems = recentReports.reports.map((report) => ({
    id: report.id,
    title: report.title,
    detail: `${report.status.toUpperCase()} · ${formatMoney(report.totalAmount)}`,
    actor: report.creatorName ?? "Unknown user",
    timestamp: report.createdAt,
    status: report.status,
    href: "/workspace/reports",
  }));

  const recentReceiptItems = recentReceipts.rows.map((receipt) => ({
    id: receipt.id,
    kind: "receipt" as const,
    title: receipt.vendor_name
      ? `Receipt from ${receipt.vendor_name}`
      : "Receipt uploaded",
    detail: `${formatMoney(receipt.amount)} · ${receipt.category ?? "Uncategorized"} · ${receipt.status.replace(/_/g, " ")}`,
    actor: receipt.actor_name,
    timestamp: receipt.created_at,
    tone: "emerald" as const,
  }));

  const recentIssueItems = recentPolicyIssues.rows.map((issue) => ({
    id: issue.id,
    kind: "violation" as const,
    title: `${issue.severity.toUpperCase()} policy issue`,
    detail: `${issue.rule_code} · ${issue.message}`,
    actor: issue.owner_name ?? issue.receipt_vendor ?? "Workspace",
    timestamp: issue.created_at,
    tone: issue.severity === "error" ? ("rose" as const) : ("amber" as const),
  }));

  const activityItems: ActivityItem[] = [
    ...recentReceiptItems,
    ...recentReportItems.map((item) => ({
      id: `report-${item.id}`,
      kind: "report" as const,
      title: `Report ${item.status.replace(/_/g, " ")}`,
      detail: item.detail,
      actor: item.actor,
      timestamp: item.timestamp,
      tone: "blue" as const,
    })),
    ...recentIssueItems,
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 8);

  const queueItems: QueueItem[] = canReview
    ? pendingApprovalsResult.rows.map((approval) => ({
        id: approval.id,
        title: approval.report_title,
        detail: `${formatMoney(approval.total_amount)} · level ${approval.current_level}/${approval.total_levels}`,
        actor: approval.requester_name,
        timestamp: approval.created_at,
        status: "Awaiting approval",
        href: "/workspace/approvals",
      }))
    : recentReportItems.map((report) => ({
        id: report.id,
        title: report.title,
        detail: report.detail,
        actor: report.actor,
        timestamp: report.timestamp,
        status: report.status.replace(/_/g, " "),
        href: "/workspace/reports",
      }));

  const topContributors: ContributorRow[] = contributorRows.rows.map((row) => ({
    name: row.name,
    totalSpend: Number(row.total_spend ?? 0),
    receiptCount: Number(row.receipt_count ?? 0),
  }));

  return {
    summary: {
      currentSpend,
      previousSpend,
      totalTax,
      receiptCount,
      averageReceipt,
      openReports,
      reviewQueue,
      policyIssues,
      duplicateReceipts,
      monthOverMonthChange,
      receiptQuotaRemaining,
      trialDaysLeft,
    },
    trend,
    categories,
    activity: activityItems,
    queueItems,
    queueLabel: canReview ? "Pending approvals" : "Your recent reports",
    topContributors,
    maxTrendValue,
  };
}

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
    redirect("/login");
  }

  const [user, tenant] = await Promise.all([
    getUserById(authContext.userId),
    getTenantById(authContext.tenantId),
  ]);

  if (!tenant) {
    redirect("/login");
  }

  const displayName = user
    ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
    : "Workspace user";

  const role = authContext.role as DashboardRole;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const canReview = role === "manager" || role === "admin";
  const dashboard = await loadDashboardData({
    tenantId: authContext.tenantId,
    userId: authContext.userId,
    role,
    receiptQuotaMonthly: tenant.receipt_quota_monthly,
    trialEndsAt: tenant.trial_ends_at ?? null,
    dateRangeMode,
    customStartDate,
    customEndDate,
  });

  const summaryCards: SummaryCard[] = [
    {
      label: "Spend this month",
      value: formatMoney(dashboard.summary.currentSpend),
      note: formatCompactPercent(dashboard.summary.monthOverMonthChange),
      icon: TrendingUp,
      accent: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Total tax",
      value: formatMoney(dashboard.summary.totalTax),
      note: "CGST + SGST + IGST across receipts",
      icon: CheckCircle2,
      accent: "bg-sky-50 text-sky-700",
    },
    {
      label: "Receipts",
      value: String(dashboard.summary.receiptCount),
      note: "Captured in the selected month",
      icon: FileText,
      accent: "bg-violet-50 text-violet-700",
    },
    {
      label: "Average receipt",
      value: formatMoney(dashboard.summary.averageReceipt),
      note: "Typical ticket size this month",
      icon: Activity,
      accent: "bg-slate-50 text-slate-700",
    },
    {
      label: "Open reports",
      value: String(dashboard.summary.openReports),
      note: canReview
        ? "Reports waiting in the workflow"
        : "Your drafts and submissions",
      icon: FileUp,
      accent: "bg-amber-50 text-amber-700",
    },
    {
      label: canReview ? "Pending approvals" : "Review queue",
      value: String(dashboard.summary.reviewQueue),
      note: canReview
        ? "Manager queue for this workspace"
        : "Your reports waiting for review",
      icon: Clock3,
      accent: "bg-orange-50 text-orange-700",
    },
    {
      label: "Policy issues",
      value: String(dashboard.summary.policyIssues),
      note: `${dashboard.summary.duplicateReceipts} duplicate receipt(s) flagged`,
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

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
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
                ["Current spend", formatMoney(dashboard.summary.currentSpend)],
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

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr] w-full">
        <Card className="border-slate-200 shadow-sm flex flex-col min-h-[400px] w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <TrendingUp className="h-5 w-5 text-slate-500" />
              Spending trend
            </CardTitle>
            <CardDescription className="text-xs">
              Last 30 days of live workspace spend and tax
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col w-full">
            <div className="flex-1 overflow-x-auto min-w-0 w-full">
              {dashboard.trend.length > 0 ? (
                <div className="inline-grid grid-flow-col auto-cols-[minmax(18px,1fr)] gap-0.5 py-2 px-1 w-full">
                  {dashboard.trend.map((point) => {
                    const height =
                      dashboard.maxTrendValue > 0
                        ? Math.max(
                            8,
                            (point.amount / dashboard.maxTrendValue) * 140,
                          )
                        : 8;
                    return (
                      <div
                        key={point.date}
                        className="flex flex-col items-center gap-0.5 w-full"
                      >
                        <div className="flex h-36 w-full items-end rounded-lg bg-slate-50 px-0.5 py-1.5">
                          <div
                            className="w-full rounded-lg bg-gradient-to-t from-slate-950 via-slate-900 to-emerald-600"
                            style={{ height: `${height}px` }}
                            title={`${point.date} · ${formatMoney(point.amount)}`}
                          />
                        </div>
                        <div className="text-center text-[9px] text-slate-500 min-h-7 w-full">
                          <p className="font-medium text-slate-700 line-clamp-1">
                            {point.label || ""}
                          </p>
                          <p className="line-clamp-1">
                            {point.amount > 0 ? formatMoney(point.amount) : "-"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500 w-full">
                  No trend data for this period
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Spend
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Tax
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm flex flex-col min-h-[400px] w-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
              <Activity className="h-5 w-5 text-slate-500" />
              Spend by category
            </CardTitle>
            <CardDescription className="text-xs">
              Top categories for the current month
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-3 w-full">
            {dashboard.categories.length > 0 ? (
              dashboard.categories.map((category, index) => (
                <div key={category.category} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {category.category}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {category.count} receipt(s) ·{" "}
                        {formatMoney(category.tax)} tax
                      </p>
                    </div>
                    <p className="text-slate-600 font-medium whitespace-nowrap">
                      {formatMoney(category.amount)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${index === 0 ? "bg-slate-950" : index === 1 ? "bg-emerald-500" : index === 2 ? "bg-sky-500" : "bg-violet-500"}`}
                      style={{ width: `${Math.max(category.share, 6)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-600 text-center">
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
          <CardContent className="space-y-4">
            {dashboard.activity.length > 0 ? (
              dashboard.activity.map((item) => {
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
                  Month-to-date spend by teammate
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
                  Keep an eye on what needs attention this month.
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
              A compact operational view for the current month
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ["Monthly spend", formatMoney(dashboard.summary.currentSpend)],
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
  );
}
