# Dashboards & Analytics Story

**Status:** Done  
**Story Type:** User Experience  
**Real-life reference:** A finance director logs in Monday morning and sees total spending, budget remaining, policy violations, and top spending categories—all at a glance. One chart shows weekly trend; another shows breakdown by team member.

## Why This Exists

The dashboard is the first thing users see after authentication. It's the control center for expense management—giving visibility into spending trends, pending approvals, policy violations, and key metrics. Without it, users have no overview of their financial data.

## What the User Does

1. Logs into Spendly after creating an account or being invited.
2. Lands on the dashboard home page.
3. Sees a summary of total spending, budget usage, and trends.
4. Checks recent receipts and pending approvals.
5. Views category breakdowns and spending patterns.
6. Accesses quick actions to upload a receipt or create a report.

## Real-Life Example

A finance director at BluePeak Studio logs in Monday morning and sees:

- Total spending this month: ₹78,500
- Budget remaining: ₹21,500 (21% left)
- 12 unreviewed receipts waiting for approval
- Top spending category: Travel (₹42,000)
- Compliance status: 2 policy violations flagged
- Quick action: Upload 3 pending receipts from the weekend

The director can drill into each metric or jump directly to the approval queue.

## How It Works

- Dashboard loads data from read-only views and cached metrics.
- Data is aggregated by tenant and role (admins see all, employees see only their own).
- Charts and metrics are rendered using Recharts.
- Key data points are cached in Redis for performance.
- Role-based visibility: finance managers see approvals queue, employees see personal metrics.
- Quick actions are contextual shortcuts to other features.

## Backend Flow

- Fetch tenant ID from JWT.
- Query aggregated spending metrics (total, by category, by user, by time period).
- Query pending approvals, violations, and recent activity.
- Aggregate policy compliance status.
- Cache results in Redis with TTL.
- Return JSON payload to frontend.

## Data Touchpoints

- `expenses` (aggregation queries)
- `receipts` (recent activity)
- `approvals` (pending queue)
- `expense_policies` (compliance checks)
- `tenants` (budget and limits)
- `audit_logs` (recent actions)
- Redis (cached metrics)

## Frontend Components

- **Metric Cards**: Total spending, budget remaining, pending approvals, policy violations
- **Line Chart**: Spending trend over time (last 30 days)
- **Pie/Donut Chart**: Spending by category
- **Recent Activity List**: Latest receipts and approvals
- **Quick Actions Bar**: Upload receipt, create report, view approvals
- **Role-Based Panels**: Finance managers see extra insights (team spending, policy violations)

## Acceptance Checklist

- [ ] Display total spending and budget remaining.
- [ ] Show spending trend chart (last 30 days).
- [ ] Display category breakdown with pie chart.
- [ ] Show recent receipts and approvals (last 7 days).
- [ ] Highlight pending approvals and policy violations.
- [ ] Implement role-based visibility (admin vs. employee).
- [ ] Cache metrics in Redis for sub-second loads.
- [ ] Add quick action buttons (upload, report, approvals).
- [ ] Mobile-responsive layout.
- [ ] Load time under 2 seconds.

## Progress Notes

- Implemented as the authenticated workspace home page.
- Uses server-side auth context to protect access and redirect unauthenticated users.
- Shows summary cards, spending trend, category breakdown, activity feed, approvals, compliance, and quick actions.
- Cookie-based login now lands users on the protected dashboard after sign-in.
