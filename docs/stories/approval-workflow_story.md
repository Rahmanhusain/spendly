# Reports & Approval Workflow Story

**Status:** Done  
**Last Updated:** 2026-05-25  
**Story Type:** Business Logic  
**Real-life reference:** An employee submits travel receipts for a week-long client visit. Manager reviews, asks for a receipt detail, employee responds. Manager approves, employee gets reimbursement status.

## Why This Exists

Individual receipts don't tell the full story. Expenses happen in projects, trips, or events. Reports group receipts, require approval, and create an audit trail. This story bridges uploaded receipts and approved expenses for reimbursement or company use.

## What the User Does

1. Uploads several receipts over a few days.
2. Clicks "Create Report" button.
3. Selects receipts to include, adds a description ("Client visit to San Francisco, March 10-12").
4. Clicks "Submit for Approval".
5. Manager gets email notification.
6. Manager reviews report, sees receipt previews, total amount.
7. Manager comments: "Can you clarify the lunch charge on March 11?"
8. Employee replies (threaded comment): "Client entertainment for ABC Corp."
9. Manager approves.
10. Employee sees report status: "Approved" + reimbursement status: "Pending".

## Real-Life Example

Sarah (Employee) at BluePeak Studio spent ₹8,500 on a 3-day client visit:

- Hotel: ₹3,500
- Taxi: ₹2,000
- Meals: ₹2,500
- Wifi: ₹500

She creates a report titled "ABC Corp Site Visit, March 10-12", adds a note, and submits. Manager Ali reviews → asks 1 clarifying question in a comment → Sarah responds → Ali approves in 2 minutes. No email ping-pong, all in-app in real-time.

## How It Works

### Report Lifecycle

1. **Draft**: User creates report, selects receipts, optionally adds notes.
2. **Submitted**: User clicks "Submit", report goes to approval queue.
3. **Pending Approval**: Manager sees in dashboard (counts as notification).
4. **Approved**: Manager approves, report status changes, employee is notified.
5. **Rejected**: Manager rejects (with reason), returns to Draft for employee to fix.
6. **Paid**: Admin marks as paid (via UPI/Bank transfer), employee sees status.

### Comments & Threading

- Any user on the report can add comments (real-time, Slack-like).
- Comments are stored per report or per receipt.
- No email notifications for comments (all in-app); prevents ping-pong.
- Manager can "Request Info" which changes report status to "Info Requested".

### Real-Time Updates

- WebSocket connection (optional for MVP; polling fine for v1).
- When manager approves, employee sees status change immediately.
- Comment notifications appear live.

## Backend Flow

1. **Create Report**:
   - Validate user is in tenant.
   - Create `expense_reports` row (draft status).
   - User selects receipts → add to `expense_report_items`.

2. **Submit Report**:
   - Validate all receipts are in final status (not disputed).
   - Check policy violations (if any receipt violates policy, warn user).
   - Set report status to "submitted".
   - Notify manager (email + in-app).

3. **Manager Approves**:
   - Validate manager role.
   - Set report status to "approved".
   - Create `approval_workflows` record if using multi-level approvals.
   - Notif employee.

4. **Add Comment**:
   - Create `comments` table or add to `expense_reports.comments` JSONB.
   - Broadcast via WebSocket (optional).

5. **Mark as Paid**:
   - Admin or manager updates report.
   - Set `paid_at` timestamp.
   - Notify employee → reimbursement status shows "Paid via [UPI/Bank]".

## Data Touchpoints

- `expense_reports` (report metadata)
- `expense_report_items` (receipts in report)
- `receipts` (individual receipts)
- `approval_workflows` (approval chain, if multi-level)
- `comments` (or JSONB field for threaded comments)
- `audit_logs` (track status changes)

## Frontend Components

- **Create Report Button**: Link from receipt list or dashboard.
- **Report Form**:
  - Title (auto-filled from dates/receipts).
  - Period start/end dates.
  - Selected receipts (with preview thumbnails).
  - Notes/description field.
  - Submit button.
- **Manager Approval View**:
  - Report summary (title, submitter, total, receipts list).
  - Receipt previews (carousel or grid).
  - List of receipts with amounts.
  - **Comments section**: Threaded (like Slack).
  - Approve / Reject / Request Info buttons.
- **Employee View**:
  - List of submitted reports (status badge).
  - Open report → see manager comments, approval status.
  - Reimbursement status (Pending / Paid via [method]).

## Acceptance Checklist

- [ ] Create report from receipts.
- [ ] Report lifecycle (Draft → Submitted → Approved → Paid).
- [ ] Manager approval UI with receipt previews.
- [ ] Threaded comments on reports (no email ping-pong).
- [ ] Real-time comment notifications (in-app).
- [ ] Employee can respond to "Request Info".
- [ ] Reject report feature (with reason text).
- [ ] Mark report as paid (UPI/Bank dropdown).
- [ ] Reimbursement status visible to employee.
- [ ] Audit trail of all status changes.
- [ ] Multi-level approval (optional; can defer to v2).
- [ ] Mobile-friendly approval UI.

## Progress Notes

- **Dependencies**: Receipt Upload + Policy Validation (to check violations).
- **Real-time comments**: WebSocket optional for MVP; polling fine.
- **Multi-level approvals**: Can defer if over-engineered; single manager approval sufficient for MVP.
- **Reimbursement tracking**: Simple (Pending/Paid) with method (UPI/Bank). Advanced (auto-bank transfers) can be later.

Recent implementation notes (2026-05-25):

- Threaded comments API and UI are implemented and wired into the workspace.
- Audit trail endpoints and `audit_logs` integration implemented.
- `request-info` workflow endpoint and UI dialog implemented.
- `mark-paid` endpoint and reimbursement recording implemented; notifications integrated.
