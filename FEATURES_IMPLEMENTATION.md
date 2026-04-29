# Approval Workflow Features - Implementation Summary

## Features Implemented

### 1. Comments System (Database + API)

- **Database**: `report_comments` table with threading and mention support
- **API Endpoints**:
  - `GET /api/reports/{reportId}/comments` - List all comments
  - `POST /api/reports/{reportId}/comments` - Add comment with mentions
  - `DELETE /api/reports/{reportId}/comments/{commentId}` - Delete comment
- **Features**:
  - Threaded comments (parent-child relationships)
  - User mentions with @mentions
  - Automatic notifications to mentioned users
  - Resolve/unresolve comments for tracking

### 2. Audit Trail (Database + API)

- **Database**: `audit_logs` table with detailed change tracking
- **API Endpoints**:
  - `GET /api/reports/{reportId}/audit-trail` - Get full audit log + activity summary
- **Features**:
  - Tracks all status changes with old/new values
  - Logs comments, approvals, rejections, payments
  - User attribution for all actions
  - Activity summary (created, submitted, approved, rejected, paid dates)

### 3. "Request Info" Workflow (Database + API)

- **Database**: `report_status` enum includes `info_requested`
- **API Endpoints**:
  - `POST /api/reports/{reportId}/request-info` - Request additional info
- **Features**:
  - Manager can request more info without rejecting
  - Reason text required with request
  - Employee notified immediately
  - Report returns to draft for employee to update
  - Status flow: submitted → info_requested → (employee updates) → resubmit → approval

### 4. Mark as Paid + Reimbursement (Database + API)

- **Database**: `reimbursements` table with payment tracking
- **API Endpoints**:
  - `POST /api/reports/{reportId}/mark-paid` - Mark approved report as paid
  - `GET /api/reports/{reportId}/mark-paid` - Get payment details
- **Features**:
  - Payment methods: UPI, Bank, Cash, Other
  - Reference number (transaction ID, check number, etc.)
  - Amount paid tracking
  - Paid by (admin/manager) and timestamp
  - Employee notified on payment
  - Status flow: approved → paid

### 5. Mentions & Notifications

- **Utilities**: `lib/utils/notifications.ts`
- **Features**:
  - In-app notifications for mentions
  - In-app notifications for status changes
  - Comment notifications
  - Payment notifications
  - Notification read/unread tracking

## Database Schema Changes

### Added Columns:

- `report_comments.mentioned_user_ids` (JSONB) - Array of mentioned user IDs

### Tables Already Present:

- `report_comments` - For threaded discussion
- `audit_logs` - For activity tracking
- `reimbursements` - For payment tracking
- `notifications` - For user notifications

## API Layer Structure

### Repositories Created:

1. **reportCommentsRepository.ts**
   - createReportComment
   - getReportComments
   - deleteReportComment
   - resolveReportComment
   - getMentionedUsers

2. **auditRepository.ts**
   - createAuditLog
   - getReportAuditLog
   - logReportStatusChange
   - getReportActivitySummary

3. **reimbursementRepository.ts**
   - createOrUpdateReimbursement
   - getReimbursement
   - getReimbursementStatus
   - deleteReimbursement

### Extended Repositories:

4. **reportRepository.ts** (extended)
   - requestInfoReport() - New method
   - markReportAsPaid() - New method

### API Routes Created:

1. `/api/reports/[reportId]/comments` - Comments management
2. `/api/reports/[reportId]/audit-trail` - Audit log viewer
3. `/api/reports/[reportId]/request-info` - Request info workflow
4. `/api/reports/[reportId]/mark-paid` - Payment processing

### Utilities Created:

5. `lib/utils/notifications.ts`
   - sendNotification()
   - getUnreadNotifications()
   - markNotificationAsRead()
   - markAllNotificationsAsRead()

### Frontend Implemented:

6. `app/workspace/create-report/expense-report-workspace.tsx`

- Threaded comments with mentions
- Audit trail viewer
- Request info dialog
- Mark as paid dialog
- Reimbursement status summary

## Status Flow Diagram

```
Draft
  ↓
Submit → Submitted
  ↓         ↓
  ×  Request Info ← (Manager requests more info)
       ↓
    (Employee updates) → Resubmit
       ↓
    Submitted
       ↓
  Approve/Reject
     ↙   ↘
 Approved  Rejected → Draft
    ↓
 Mark as Paid
    ↓
  Paid
```

## Frontend Notes

- The report workspace already includes the collaboration UI.
- Updates are refreshed by refetching report activity after actions.
- WebSocket/Redis support remains a later enhancement.

## Permissions

- **Employee**: Can create, submit, update (if info requested), view own reports
- **Manager**: Can approve, reject, request info, mark as paid, view team reports
- **Admin**: Full access to all features

## Next Steps

1. Test all API endpoints in the report workspace
2. Add email notifications (mailer integration)
3. Add realtime WebSocket support only if the product needs it later
