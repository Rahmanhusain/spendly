# Create Account Story

**Status:** Done  
**Story Type:** Foundation  
**Real-life reference:** A finance manager at a 12-person startup creates the company workspace and invites the first employees.

## Why This Exists

Every SaaS tenant starts with one company account. In Spendly, the first step is not a user profile, it is a company workspace that owns all receipts, policies, and approvals.

## What the User Does

1. Opens Spendly sign-up.
2. Enters company name, email, and password.
3. Chooses country/region, such as India.
4. Creates the first admin user for the tenant.
5. Gets redirected into the empty company workspace.

## Real-Life Example

A small agency in Gurgaon wants to track travel and client meal expenses. The founder signs up, creates the tenant called `BluePeak Studio`, and becomes the workspace admin. After that, the founder can invite the bookkeeper and two project leads.

## How It Works

- The backend creates a tenant record first.
- The first user is linked to that tenant as `admin`.
- Passwords are hashed before storage.
- A JWT access token and refresh token are returned.
- The workspace is empty until receipts and users are added.

## Backend Flow

- Validate the request.
- Check for duplicate company name or email.
- Create `tenants` row.
- Create `users` row with `tenant_id` and `role=admin`.
- Create an initial default policy bundle.
- Return auth tokens.

## Data Touchpoints

- `tenants`
- `users`
- `expense_policies`
- `audit_logs`

## Acceptance Checklist

- [x] Create tenant and first admin user.
- [x] Return JWT tokens after sign-up.
- [x] Reject duplicate workspace or email.
- [x] Log the account creation event.
- [x] Redirect the user into the dashboard.

## Progress Notes

- Implemented in the landing page, signup page, and `POST /api/auth/signup`.
- This story unlocks all other tenant-aware features.
