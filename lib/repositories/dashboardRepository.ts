import "server-only";

import { query } from "@/lib/db/client";
import { getReportsForTenant } from "@/lib/repositories/reportRepository";

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

function formatMoney(value: number | string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export type DashboardRole = "employee" | "manager" | "admin";

export type DashboardData = {
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

function getDaySpanInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
}

function buildTrendSeries(
  startDate: string,
  endDate: string,
  rows: Array<{ day: string; amount: string; tax: string; receipts: string }>,
): TrendPoint[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const rangeDays = getDaySpanInclusive(startDate, endDate);
  const bucketMode =
    rangeDays > 365 ? "month" : rangeDays > 90 ? "week" : "day";

  const rowMap = new Map(rows.map((row) => [row.day, row]));
  const points: TrendPoint[] = [];

  if (bucketMode === "day") {
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

  const bucketCursor = new Date(start);

  while (bucketCursor <= end) {
    const bucketStart = new Date(bucketCursor);
    const bucketEnd = new Date(bucketCursor);

    if (bucketMode === "week") {
      bucketEnd.setDate(bucketEnd.getDate() + 6);
    } else {
      bucketEnd.setMonth(bucketEnd.getMonth() + 1, 0);
    }

    if (bucketEnd > end) {
      bucketEnd.setTime(end.getTime());
    }

    let amount = 0;
    let tax = 0;
    let receipts = 0;
    const dayCursor = new Date(bucketStart);

    while (dayCursor <= bucketEnd) {
      const key = dateKey(dayCursor);
      const row = rowMap.get(key);

      if (row) {
        amount += Number(row.amount ?? 0);
        tax += Number(row.tax ?? 0);
        receipts += Number(row.receipts ?? 0);
      }

      dayCursor.setDate(dayCursor.getDate() + 1);
    }

    points.push({
      date: dateKey(bucketStart),
      label: bucketStart.toLocaleDateString("en-IN", {
        month: "short",
        day: bucketMode === "week" ? "numeric" : undefined,
      }),
      amount,
      tax,
      receipts,
    });

    bucketCursor.setTime(bucketEnd.getTime());
    bucketCursor.setDate(bucketCursor.getDate() + 1);
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

export async function loadDashboardData(input: {
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

  let currentMonth, previousMonth, trendWindow;

  if (dateRangeMode === "all-time") {
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
    const endDateObj = new Date(customEndDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
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
          AND r.status = 'verified'
          AND r.receipt_date >= $3::date
          AND r.receipt_date < $4::date`
      : `SELECT
          COUNT(*)::text AS receipt_count,
          COALESCE(SUM(r.amount), 0)::text AS total_spend,
          COALESCE(SUM(COALESCE(r.tax_amount, 0)), 0)::text AS total_tax,
          COUNT(*) FILTER (WHERE r.is_duplicate)::text AS duplicate_count
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.status = 'verified'
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
          AND r.status = 'verified'
          AND r.receipt_date >= $3::date
          AND r.receipt_date < $4::date`
      : `SELECT COALESCE(SUM(r.amount), 0)::text AS total_spend
        FROM receipts r
        WHERE r.tenant_id = $1
          AND r.status = 'verified'
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
          AND r.status = 'verified'
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
          AND r.status = 'verified'
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
          AND r.status = 'verified'
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
          AND r.status = 'verified'
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
        LIMIT 7`
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
        LIMIT 7`,
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
          AND r.status = 'verified'
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
    .slice(0, 10);

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

export async function loadDashboardActivity(input: {
  tenantId: string;
  userId: string;
  role: DashboardRole;
  limit?: number;
}): Promise<ActivityItem[]> {
  const { tenantId, userId, role, limit = 10 } = input;
  const isEmployee = role === "employee";
  const canReview = role === "manager" || role === "admin";

  const recentReceiptsPromise = query<{
    id: string;
    vendor_name: string | null;
    amount: string;
    status: string;
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
          r.created_at::text AS created_at,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS actor_name,
          r.category
        FROM receipts r
        JOIN users u ON u.id = r.user_id
        WHERE r.tenant_id = $1
          AND r.user_id = $2
        ORDER BY r.created_at DESC
        LIMIT $3`
      : `SELECT
          r.id,
          r.vendor_name,
          r.amount::text AS amount,
          r.status,
          r.created_at::text AS created_at,
          COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS actor_name,
          r.category
        FROM receipts r
        JOIN users u ON u.id = r.user_id
        WHERE r.tenant_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2`,
    isEmployee ? [tenantId, userId, limit] : [tenantId, limit],
  );

  const recentReportsPromise = getReportsForTenant(tenantId, {
    limit: Math.min(5, limit),
    userId: isEmployee ? userId : undefined,
    status: "all",
  });

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
        LIMIT $3`
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
        LIMIT $2`,
    isEmployee ? [tenantId, userId, limit] : [tenantId, limit],
  );

  const [recentReceipts, recentReports, recentPolicyIssues] = await Promise.all(
    [recentReceiptsPromise, recentReportsPromise, recentPolicyIssuesPromise],
  );

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

  const recentReportItems = recentReports.reports.map((report) => ({
    id: `report-${report.id}`,
    kind: "report" as const,
    title: `Report ${report.status.replace(/_/g, " ")}`,
    detail: `${report.status.toUpperCase()} · ${formatMoney(report.totalAmount)}`,
    actor: report.creatorName ?? "Unknown user",
    timestamp: report.createdAt,
    tone: "blue" as const,
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

  return [...recentReceiptItems, ...recentReportItems, ...recentIssueItems]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
}
