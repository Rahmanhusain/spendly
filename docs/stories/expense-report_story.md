# Expense Report Story

**Status:** Done  
**Last Updated:** 2026-05-25  
**Story Type:** Core Workflow  
**Real-life reference:** A manager groups several work-related receipts into one monthly expense report before submitting it for approval.

## Why This Exists

Receipts alone are not enough. The product needs a report layer where employees can organize expenses by trip, project, or date range.

## What the User Does

1. Opens the expense report screen.
2. Creates a new report for a trip or month.
3. Adds uploaded receipts to the report.
4. Reviews totals and notes.
5. Submits the report for approval.

## Real-Life Example

A sales lead in Mumbai returns from a client visit. They collect taxi, hotel, and meal receipts into one report called `Mumbai Client Trip - April` and send it to their manager for approval.

## How It Works

- The backend creates an expense report linked to the tenant and user.
- Receipts are attached through a join table.
- Totals are recalculated whenever a receipt is added or removed.
- The report status changes as it moves through approval.

## Backend Flow

- Validate the report title and date range.
- Insert a new row in `expense_reports`.
- Link receipts through `expense_report_items`.
- Recalculate the total amount.
- Store an audit log entry for each change.

## Data Touchpoints

- `expense_reports`
- `expense_report_items`
- `receipts`
- `approval_workflows`
- `audit_logs`

## Acceptance Checklist

- [ ] Create draft expense report.
- [ ] Add and remove receipts.
- [ ] Recalculate totals correctly.
- [ ] Submit report for approval.
- [ ] Preserve the report audit trail.

## Progress Notes

- This story comes after receipt upload.
- It bridges raw receipts and approval workflow.

Recent implementation notes (2026-05-25):

- Backend `expense_reports` and `expense_report_items` APIs implemented.
- Frontend workspace panel for creating reports, adding receipts, and recalculating totals is present (`expense-report-workspace.tsx`).
- Acceptance checklist implementation in progress; audit trail and report submission integrated with approval workflow.
