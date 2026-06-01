# Team & Org Setup Story

**Status:** Planned  
**Story Type:** Foundation  
**Real-life reference:** A startup founder creates their company workspace and invites their finance manager and team members by email.

## Why This Exists

Multi-tenant SaaS requires clear org/team structure from day one. During the 15-day trial, teams can invite colleagues and evaluate the full product with proper role-based access. This story establishes the foundation for all other features.

## What the User Does

1. Signs up with company name, email, and password.
2. Creates the first workspace admin account.
3. Sends email invites to teammates from the workspace.
4. Team members open the email invite, accept it, and join the workspace.
5. Admin assigns roles during the invite flow: Employee, Manager, Admin.
6. Each user logs in and sees their workspace dashboard.

## Real-Life Example

A founder at "BluePeak Studio" signs up, becomes the workspace admin, and gets an invite link. They send it to:

- Finance manager Sarah (assigned as Manager role → can approve reports)
- Developer Ali (assigned as Employee role → can upload receipts)

Sarah can now see all team expenses. Ali can only upload his own.

## How It Works

- **Signup**: Creates the tenant record plus the first admin user.
- **Invite by email**: Admin enters a teammate's email, chooses a role, and the system sends an invite link.
- **Invite acceptance**: The teammate opens the email, verifies the invite token, and joins the workspace.
- **Roles**:
  - **Employee**: Upload receipts, submit reports, view only their own expenses.
  - **Manager**: View team expenses, approve/reject reports, add comments.
  - **Admin**: Everything plus manage policies, invite users, and billing settings.
- **Multi-tenant isolation**: Every query filtered by `tenant_id` (PostgreSQL row-level security).
- **Subscription model**:
  - All workspaces start on a 15-day free trial.
  - Trial includes full product access for onboarding, receipts, approvals, and compliance.

## Backend Flow

1. **Signup**:
   - Validate email (not already in use globally).
   - Create `tenants` row.
   - Create `users` row with `role=admin`.
   - Hash password, store securely.
   - Return JWT tokens (access + refresh).

2. **Invite Email Generation**:
   - Admin creates an invite for a specific email address.
   - System creates a token with an expiry.
   - Email sends a secure invite URL to the teammate.
   - Link expires in 7 days.

3. **Accept Invite**:
   - Verify token is valid and not expired.
   - Create a new `users` row if the person does not already exist.
   - Attach the invite to the user and set their role.
   - User logs in with email + password.

## Data Touchpoints

- `tenants` (org record)
- `users` (team members)
- `teams` (optional: sub-groups within org)
- `team_members` (if teams used)
- `audit_logs` (track who created/invited/removed users)

## Frontend Components

- Sign-up form (company name, email, password)
- Workspace dashboard: Invite button for email-based onboarding
- User management page: List members, assign roles, revoke access
- Role selector: Dropdown for each invite or user (Employee/Manager/Admin)
- Invite email template with a click-through link

## Acceptance Checklist

- [ ] Signup creates tenant and first admin user.
- [ ] Trial onboarding grants full feature access for 15 days.
- [ ] Invite email generation and delivery.
- [ ] Invite link expiry (7 days).
- [ ] User role assignment UI.
- [ ] JWT tokens returned correctly.
- [ ] All API queries filtered by tenant_id.
- [ ] Reject duplicate workspace names.
- [ ] Log all user invitations in audit_logs.
- [ ] Multi-tenant isolation tests pass.

## Progress Notes

- **Dependencies**: Comes first; unblocks all other features.
- **Trial caveat**: Teams should receive clear trial countdown messaging before expiration.
- **Invite links**: Use email-delivered invite URLs with expiring tokens.
- **Testing**: Multi-tenant isolation is critical; test DB-level RLS policies.
