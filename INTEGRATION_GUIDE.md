# Approval Workflow Features - Integration Guide

## ✅ What's Implemented

### Backend Components (Complete)

1. **Comment System**
   - Repository: `lib/repositories/reportCommentsRepository.ts`
   - API: `app/api/reports/[reportId]/comments/route.ts`
   - Features: Threading, mentions, auto-notifications

2. **Audit Trail**
   - Repository: `lib/repositories/auditRepository.ts`
   - API: `app/api/reports/[reportId]/audit-trail/route.ts`
   - Features: Full change tracking, activity summary

3. **"Request Info" Workflow**
   - Repository: Extended `lib/repositories/reportRepository.ts`
   - API: `app/api/reports/[reportId]/request-info/route.ts`
   - Features: Change status to info_requested, notify employee

4. **Mark as Paid**
   - Repository: `lib/repositories/reimbursementRepository.ts`
   - API: `app/api/reports/[reportId]/mark-paid/route.ts`
   - Features: Record payments, track reimbursement status

5. **Notifications Utility**
   - Utility: `lib/utils/notifications.ts`
   - Features: Send, read, track notifications

6. **Report Activity UI**

- Workspace: `app/workspace/create-report/expense-report-workspace.tsx`
- Features: threaded comments, mentions, audit trail, request info, mark as paid

### Database Schema Updated

- Added `mentioned_user_ids` column to `report_comments`
- All other tables already present

---

## 🔧 How to Use

### 1. Add a Comment with Mentions

```typescript
const response = await fetch(`/api/reports/${reportId}/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Hey @user1, can you clarify the hotel charges?",
    mentionedUserIds: ["user1-id"],
  }),
});
```

### 2. Get All Comments

```typescript
const response = await fetch(`/api/reports/${reportId}/comments`);
const { data } = await response.json();
// data.comments = array of comments with author info
```

### 3. View Audit Trail

```typescript
const response = await fetch(`/api/reports/${reportId}/audit-trail`);
const { data } = await response.json();
// data.auditLog = all status changes
// data.activity = summary of key dates
```

### 4. Request Additional Info (Manager only)

```typescript
const response = await fetch(`/api/reports/${reportId}/request-info`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    reason: "Please provide vendor GSTIN for the hotel receipt",
  }),
});
```

### 5. Mark Report as Paid (Manager only)

```typescript
const response = await fetch(`/api/reports/${reportId}/mark-paid`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    method: "upi", // or "bank", "cash", "other"
    referenceNumber: "TXN123456",
    amountPaid: 10000,
  }),
});
```

---

## 🎨 Frontend Integration Steps

> Note: the current app already includes the report collaboration panel in the workspace. The steps below are retained as reference for how the data flow works.

### Step 1: Update `expense-report-workspace.tsx` State

Add new state variables to track:

```typescript
const [reportComments, setReportComments] = useState([]);
const [auditTrail, setAuditTrail] = useState(null);
const [showRequestInfoDialog, setShowRequestInfoDialog] = useState(false);
const [showMarkPaidDialog, setShowMarkPaidDialog] = useState(false);
```

### Step 2: Load Comments & Audit Trail

Add to `useEffect` when report is selected:

```typescript
// After loadBrowseReportDetails
const [comments, trail] = await Promise.all([
  fetch(`/api/reports/${reportId}/comments`).then((r) => r.json()),
  fetch(`/api/reports/${reportId}/audit-trail`).then((r) => r.json()),
]);
setReportComments(comments.data.comments);
setAuditTrail(trail.data);
```

### Step 3: Create Comments Component

Location: `components/ReportCommentsPanel.tsx`

```typescript
import React from "react";

export function ReportCommentsPanel({
  comments,
  reportId,
  onAddComment,
  userRole,
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700">Discussion</p>

      {/* Comments list */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
            <p className="text-xs font-medium text-slate-600">
              {comment.authorName} · {new Date(comment.createdAt).toLocaleDateString()}
            </p>
            <p className="mt-1 text-sm text-slate-700">{comment.message}</p>
            {comment.mentionedUserIds?.length > 0 && (
              <p className="mt-1 text-xs text-blue-600">
                Mentioned {comment.mentionedUserIds.length} user(s)
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add comment form */}
      <CommentForm reportId={reportId} onSubmit={onAddComment} />
    </div>
  );
}
```

### Step 4: Create Audit Trail Component

Location: `components/ReportAuditTrail.tsx`

```typescript
export function ReportAuditTrail({ trail }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">Activity</p>
      <div className="text-xs space-y-1 text-slate-600">
        <p>📝 Created: {new Date(trail.createdAt).toLocaleDateString()}</p>
        {trail.submittedAt && <p>✉️ Submitted: {new Date(trail.submittedAt).toLocaleDateString()}</p>}
        {trail.approvedAt && <p>✅ Approved: {new Date(trail.approvedAt).toLocaleDateString()}</p>}
        {trail.rejectedAt && <p>❌ Rejected: {new Date(trail.rejectedAt).toLocaleDateString()}</p>}
        {trail.paidAt && <p>💰 Paid: {new Date(trail.paidAt).toLocaleDateString()}</p>}
      </div>
    </div>
  );
}
```

### Step 5: Add Manager Actions

In the report details panel, add buttons for managers:

```typescript
{report.status === "submitted" && userRole === "manager" && (
  <div className="flex gap-2 mt-4">
    <button
      onClick={() => setShowRequestInfoDialog(true)}
      className="flex-1 px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
    >
      Request Info
    </button>
    <button
      onClick={() => handleApproveReport(report.id)}
      className="flex-1 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
    >
      Approve
    </button>
  </div>
)}

{report.status === "approved" && userRole === "manager" && (
  <button
    onClick={() => setShowMarkPaidDialog(true)}
    className="w-full px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  >
    Mark as Paid
  </button>
)}
```

### Step 6: Create Request Info Dialog

```typescript
function RequestInfoDialog({ reportId, onSubmit, onClose }) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Additional Information</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain what information is needed..."
          />
          <Button
            onClick={() => {
              onSubmit(reportId, reason);
              onClose();
            }}
          >
            Request Info
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 7: Create Mark as Paid Dialog

```typescript
function MarkAsPaidDialog({ reportId, amount, onSubmit, onClose }) {
  const [method, setMethod] = useState("upi");
  const [refNumber, setRefNumber] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark Report as Paid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full mt-1 p-2 border rounded-lg"
            >
              <option value="upi">UPI</option>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input
            placeholder="Reference Number (optional)"
            value={refNumber}
            onChange={(e) => setRefNumber(e.target.value)}
          />
          <Button
            onClick={() => {
              onSubmit(reportId, { method, referenceNumber: refNumber, amountPaid: amount });
              onClose();
            }}
          >
            Process Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 📋 Testing Checklist

- [ ] Add comment to report
- [ ] Mention user in comment
- [ ] Verify mentioned user gets notification
- [ ] View audit trail for report
- [ ] Manager requests info (status changes to info_requested)
- [ ] Employee is notified about info request
- [ ] Manager approves report
- [ ] Manager marks report as paid
- [ ] Employee sees payment status
- [ ] Verify all status transitions in audit trail

---

## 🚀 Deployment Notes

1. Run database migration to add `mentioned_user_ids` column
2. All API endpoints are ready to use
3. Frontend collaboration UI is already wired into the report workspace
4. Email notifications optional (mailer.ts already available)

---

## 📞 API Reference

| Endpoint                           | Method | Auth    | Description         |
| ---------------------------------- | ------ | ------- | ------------------- |
| `/api/reports/{id}/comments`       | GET    | User    | List comments       |
| `/api/reports/{id}/comments`       | POST   | User    | Add comment         |
| `/api/reports/{id}/comments/{cid}` | DELETE | User    | Delete comment      |
| `/api/reports/{id}/audit-trail`    | GET    | User    | Get audit log       |
| `/api/reports/{id}/request-info`   | POST   | Manager | Request info        |
| `/api/reports/{id}/mark-paid`      | GET    | User    | Get payment details |
| `/api/reports/{id}/mark-paid`      | POST   | Manager | Mark as paid        |

---

## 🔐 Permission Model

```
Employee:
  - Create/submit reports
  - View own reports
  - Add comments
  - Respond to info requests

Manager:
  - View team reports
  - Approve/reject reports
  - Request information
  - Mark as paid
  - Add comments

Admin:
  - Full access to all reports
  - All manager actions
```
