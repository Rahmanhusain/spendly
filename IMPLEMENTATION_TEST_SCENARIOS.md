# Expense Report Access Control & Mentions - Implementation Test Scenarios

## Feature Summary

Implemented report access control system that allows managers/admins to grant employees access to specific reports for viewing comments and being mentioned.

## Backend Implementation (✅ COMPLETE)

### 1. Database Schema

- **Table**: `report_access_list` (lines 347-358 in `spendly_schema.local.sql`)
  - Tracks which employees have access to which reports
  - Stores `added_by` to track who granted access
  - Unique constraint on `(report_id, user_id)` to prevent duplicates

### 2. Repository Functions

- **File**: `/lib/repositories/reportAccessRepository.ts`
- Functions implemented:
  - `addReportAccess()` - Add user with upsert on conflict
  - `removeReportAccess()` - Remove user from access list
  - `hasReportAccess()` - Check if user can access report (manager/admin/owner/in-access-list)
  - `canBeMentioned()` - Check if user can be mentioned (manager/admin/in-access-list)
  - `getReportAccessList()` - Fetch with user details joined
  - `getUserAccessibleReports()` - Get accessible reports for user
  - `isMentionedUserIdsColumnAvailable()` - Check for compatibility

### 3. API Endpoints

- **File**: `/app/api/reports/[id]/access/route.ts`
- Endpoints:
  - `GET /api/reports/[id]/access` - Return access list with user details
  - `POST /api/reports/[id]/access` - Add user to access list
  - `DELETE /api/reports/[id]/access?userId=<id>` - Remove user from access list
- Authorization: Only report creator, managers, and admins can manage access
- Audit logging: Creates `report_access_granted` and `report_access_revoked` events

### 4. Comments Endpoint Updates

- **File**: `/app/api/reports/[id]/comments/route.ts`
- Changes:
  - GET: Check `hasReportAccess()` before returning comments
  - POST: Validate all `mentionedUserIds` with `canBeMentioned()`, return `failedUserIds` if validation fails
  - DELETE: Check `hasReportAccess()` before allowing deletion

### 5. Report Details Endpoint Update

- **File**: `/app/api/reports/[id]/route.ts`
- Changed access check from simple role comparison to `hasReportAccess()` function

### 6. Export Functionality

- **File**: `/app/api/reports/[id]/export/route.ts`
- Features:
  - Auto-detects period from receipt dates using `getDateRangeFromReceipts()` helper
  - Falls back to report's `periodStart`/`periodEnd` if not available
  - Supports CSV and JSON export formats
  - Enforces `hasReportAccess()` check before exporting

### 7. Audit Trail Date Formatting

- **File**: `/lib/repositories/auditRepository.ts`
- Changes:
  - `getReportAuditLog()`: Wraps all `createdAt` with `formatDateToISO()`
  - `getReportActivitySummary()`: Formats all timestamp fields to ISO 8601
  - Ensures consistent date formatting across all responses

## UI Implementation (✅ COMPLETE)

### 1. Component State & Types

- **File**: `/components/report-activity-panel.tsx`
- Types added:
  - `ReportAccessEntry` - Access list entry with user and audit info
  - `AccessListResponse` - API response type
- State added:
  - `accessList` - Current access entries
  - `selectedUserForAccess` - User selected to add
  - `isAddingAccess` - Loading state for add operation

### 2. Access Control Logic

- Computed value `currentUserIsReportOwner` to check ownership
- Updated `currentUserIsManager` to also check admin role
- Filter `mentionableUsers` based on access list:
  - Employees: Only users in access list + managers/admins
  - Managers/Admins: All active users (no restriction)

### 3. Data Loading

- Updated `loadReportMeta()` to fetch access list for managers and report owners
- Access list fetched via `GET /api/reports/[id]/access`

### 4. Event Handlers

- `handleAddUserToAccess()` - Adds selected user, shows success message, refreshes list
- `handleRemoveUserFromAccess()` - Removes user with confirmation dialog

### 5. UI Panels

#### Access Management Panel

- Shows only to managers and report owners (tab conditionally visible)
- Displays current access list with:
  - Employee name and email
  - Who added them and when
  - Remove button with confirmation
- Add form with:
  - Dropdown of employees not already in access list
  - Add button with loading state
  - Only shows active employees

#### Comments Section

- Updated mention instructions:
  - For employees: "Only employees added to this report's access list can be mentioned."
  - For managers: "Select users to mention them in this comment."
- Context-aware empty state message

#### Tab Navigation

- Added "Access" tab that shows access list count
- Tab only visible to managers and report owners
- Tab labels show counts: "Comments (n)", "Access (n)"

## Test Scenarios

### Scenario 1: Manager Adds Employee to Report

**Setup**: Manager views an expense report from employee
**Steps**:

1. Manager clicks "Access" tab
2. Selects employee from dropdown
3. Clicks "Add" button
   **Expected Result**:

- Employee appears in access list
- Audit log shows "report_access_granted" event
- Employee can now view report comments
- Employee can be mentioned in comments

### Scenario 2: Employee Can't See Comment Without Access

**Setup**: Employee tries to view comments on report they're not added to
**Steps**:

1. Employee views report
2. Tries to access comments section
   **Expected Result**:

- Cannot see comments (API returns empty)
- Cannot mention other users
- Message: "No employees added to access list"

### Scenario 3: Employee Can Be Added to Access List

**Setup**: Manager adds employee to report access
**Steps**:

1. Manager follows Scenario 1
2. Employee refreshes page
3. Employee can now see comments
4. Employee tries to mention user not in access list
   **Expected Result**:

- Comments visible
- Only access list members + managers/admins appear in mention picker
- Attempting to mention unauthorized user returns error

### Scenario 4: Remove Access

**Setup**: Manager removes employee from access list
**Steps**:

1. Manager opens Access tab
2. Clicks "Remove" button on employee
3. Confirms removal
   **Expected Result**:

- Employee removed from list
- Audit log shows "report_access_revoked" event
- Employee can no longer see comments or be mentioned

### Scenario 5: Export Auto-Detects Period

**Setup**: Report has items but no period set
**Steps**:

1. Download report as CSV/JSON
   **Expected Result**:

- Period populated from earliest to latest receipt date
- CSV includes period in summary section
- JSON includes periodStart and periodEnd

### Scenario 6: Audit Trail Shows Dates in ISO Format

**Setup**: View audit trail for report
**Steps**:

1. Open "Audit trail" tab
2. Check timestamps
   **Expected Result**:

- All dates in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.SSSZ)
- Consistent across all timestamps
- Payment details show formatted dates

## Business Logic Verification

✅ **Access Control**

- [ ] Employees cannot see comments without explicit access grant
- [ ] Managers/admins always see all comments
- [ ] Report owner can manage access list
- [ ] Access is persistent and tracked in audit log

✅ **Mentions**

- [ ] Managers/admins can mention any active user
- [ ] Employees can only mention users in access list
- [ ] API validates mention permissions before creating comment
- [ ] Employees added to access list immediately become mentionable

✅ **Exports**

- [ ] Period auto-detected from receipt dates
- [ ] Falls back to report period if receipts empty
- [ ] CSV format includes all items and summary
- [ ] JSON format includes all report data

✅ **Audit Trail**

- [ ] All date fields consistently formatted
- [ ] Access grant/revoke events logged
- [ ] Comments and edits tracked with proper timestamps

## Known Limitations

1. Access list shows only active employees (by design)
2. Managers/admins cannot be added to access list (always have access)
3. Access list only controls comments and mentions (doesn't affect report overview access)
4. Export auto-period uses receipt dates only (ignores created_at dates)

## Integration Notes

- All changes are backward compatible
- Existing reports with no access list work as before (managers/admins see all)
- No database migrations needed (schema already created)
- UI gracefully handles empty access lists
