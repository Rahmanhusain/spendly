# Spendly Story Index

This file is the project progress hub. The detailed story chapters live in `docs/stories/` and are ignored by GitHub on purpose.

## Start Here (Simple Sequence)

If you are implementing now, follow this exact order:

1. `docs/stories/create-account_story.md`
2. `docs/stories/authenticationand_authorizaton_story.md`
3. `docs/stories/team-setup_story.md`
4. `docs/stories/receipt-upload_story.md`
5. `docs/stories/policy-validation_story.md`
6. `docs/stories/expense-report_story.md`
7. `docs/stories/approval-workflow_story.md`
8. `docs/stories/team-collaboration_story.md`
9. `docs/stories/gst-compliance_story.md`
10. `docs/stories/dashboard_story.md`

**MVP Timeline:** 6 weeks (Week 1-6)

## Subscription Model

| Model      | Price | Trial Duration | Features During Trial |
| ---------- | ----- | -------------- | --------------------- |
| Free Trial | $0    | 15 days        | Full product access   |

## Current Status

| Story                            | File                                                                                                         |      Status | Phase      | Notes                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------: | ---------- | --------------------------------------------- |
| Create Account                   | [docs/stories/create-account_story.md](docs/stories/create-account_story.md)                                 |        Done | Foundation | Tenant onboarding and first admin user        |
| Authentication and Authorization | [docs/stories/authenticationand_authorizaton_story.md](docs/stories/authenticationand_authorizaton_story.md) |        Done | Foundation | JWT login, roles, protected routes            |
| Team & Org Setup                 | [docs/stories/team-setup_story.md](docs/stories/team-setup_story.md)                                         |        Done | Foundation | Invites, role assignment, trial onboarding    |
| Receipt Upload & Smart Parsing   | [docs/stories/receipt-upload_story.md](docs/stories/receipt-upload_story.md)                                 |        Done | Core       | Drag/button upload, parse note required       |
| Policy Validation                | [docs/stories/policy-validation_story.md](docs/stories/policy-validation_story.md)                           |        Done | Core       | Real-time rule checks, warnings, exceptions   |
| Expense Report                   | [docs/stories/expense-report_story.md](docs/stories/expense-report_story.md)                                 |        Done | Core       | Group receipts into reports; workspace UI + APIs implemented |
| Reports & Approval Workflow      | [docs/stories/approval-workflow_story.md](docs/stories/approval-workflow_story.md)                           |        Done | Core       | Submit, approve/reject, threaded comments, audit trail, request-info, mark-as-paid implemented |
| Team Collaboration               | [docs/stories/team-collaboration_story.md](docs/stories/team-collaboration_story.md)                         |        Done (partial) | Advanced   | Threaded comments, mentions, and audit trail present; real-time presence planned |
| India GST & Compliance Reports   | [docs/stories/gst-compliance_story.md](docs/stories/gst-compliance_story.md)                                 | In Progress | Compliance | Dedicated workspace page and export history   |
| Dashboards & Analytics           | [docs/stories/dashboard_story.md](docs/stories/dashboard_story.md)                                           |        Done | Analytics  | Metrics, charts, insights, reimbursement view |

## Progress Rules

- Update the status in this file whenever a story moves from Planned to In Progress, Blocked, or Done.
- Keep one story as the active focus at a time.
- Each story file should explain the feature, the real-life workflow, the backend flow, and the progress checklist.
- Story files are intentionally kept in `docs/stories/` so they stay out of GitHub history.

## Implementation Order (All Stories)

### **Foundation**

1. **Create Account** - Tenant creation and first admin user
2. **Authentication and Authorization** - JWT auth, role guards, tenant isolation
3. **Team & Org Setup** - Invite links, role assignment, team onboarding

### **Core Workflow**

4. **Receipt Upload & Smart Parsing** - Mobile upload, OCR/AI extraction
5. **Policy Validation** - Rule checks and exception handling
6. **Expense Report** - Group receipts into draft reports
7. **Reports & Approval Workflow** - Submission, approvals, comments, reimbursement status

### **Advanced Collaboration and Compliance**

8. **Team Collaboration** - Real-time shared review and presence
9. **India GST & Compliance** - GST capture and compliance-ready exports

### **Insights and Operations**

10. **Dashboards & Analytics** - Trends, category and team insights

## Key Features by Story

### **Team & Org Setup**

- Org signup with company details
- Invite links (email magic links)
- Roles: Employee (upload/submit), Manager (approve + view team), Admin (policies + reports)
- Multi-tenant isolation in database

### **Receipt Upload & Smart Parsing**

- Mobile-first (drag-drop and choose-file upload)
- PDF support
- Instant AI parsing: amount, date, vendor, category, GST breakdown
- Real-time policy check with instant feedback ⚠️
- Duplicate detection (same vendor + amount + date)
- Category auto-suggest

### **Reports & Approval Workflow**

- One-click "Create Report" from expenses
- Add notes, split line items
- Submit → auto-notify manager (email + in-app)
- Manager: Review → Approve/Reject/Request Info
- Real-time comments (threaded like Slack, no ping-pong)

### **India GST & Compliance**

- Auto-capture CGST/SGST/IGST from receipts
- Custom "GST-Ready Report" PDF (proper breakup)
- Simple policy rules (admin sets in UI)
- Monthly "GST Summary" export for accountants

### **Dashboards & Analytics**

- Total spent this month
- Spending by category (pie chart)
- Spending by team member
- Recent receipts + pending approvals
- Reimbursement tracker (mark: Paid via UPI/Bank)
- CSV & PDF export

## Progress Log

- 2026-04-14: Restructured project around 6-week MVP roadmap.
- 2026-04-14: Aligned stories with user feature requirements.
- 2026-04-14: Removed e-invoice API (custom GST reports instead).
- 2026-04-14: Added initial multi-tier pricing model (later replaced by trial-only model).
- 2026-04-21: Switched to single 15-day trial model with full feature access.
- 2026-04-18: Implemented the landing page and the first two foundation stories.
-- 2026-05-12: Moved GST exports into a dedicated workspace page with sidebar navigation and history.
-- 2026-05-25: Implemented report collaboration backend + frontend: comments, audit trail, request-info, mark-paid, notifications.

## Enhanced UI Instruction (Apply to Every Story)

For each story implementation, include these UX requirements:

- Every action must show state feedback: loading, success, error.
- Destructive actions must use confirmation modal.
- Long tasks (parse, export, reconciliation) must show queued or processing status.
- Every status change must show actor + timestamp.
- Success and error messaging must be explicit and actionable.
- Mobile-first behavior must be verified for the story's primary flow.

Popup and notification standards:

- Use toast for short non-blocking updates.
- Use modal for delete, reject, revoke, and other irreversible actions.
- Use inline validation for field errors.
- Use progress indicators for uploads and background jobs.

## UI Starter Checklist Per Story

1. Create Account

- Signup form with inline validation and loading state.
- Success redirect feedback and first-login welcome state.

2. Authentication and Authorization

- Login form with clear error states.
- Session expiry modal with re-login flow.

3. Team and Org Setup

- Invite modal, role edit drawer, revoke confirmation modal.
- Member list table with status badges.

4. Receipt Upload and Smart Parsing

- Drag-and-drop upload zone and choose-file flow.
- Parse progress state (queued, processing, complete, failed).
- Policy warning popup for violations.

5. Policy Validation

- Rule builder form with inline previews.
- Warning chips and explanation tooltip per violation.

6. Expense Report

- Report creation wizard with step progress.
- Save draft and submit feedback toasts.

7. Reports and Approval Workflow

- Approval detail panel with sticky action bar.
- Reject and request-info modal with required reason.

8. Team Collaboration

- Threaded comments with live update indicator.
- Presence badges and unread markers.

9. India GST and Compliance

- Export wizard modal and downloadable result state.
- Export history table with timestamp and user.

10. Dashboards and Analytics

- Actionable metric cards with drill-down.
- Chart legends, filters, and no-data states.
