# Authentication and Authorization Story

**Status:** Done  
**Story Type:** Foundation  
**Real-life reference:** An employee logs in from a mobile phone, sees only the expense reports they are allowed to view, and a manager sees the approvals queue.

## Why This Exists

Spendly uses JWT instead of OAuth because the product needs direct control over tenants, roles, and offline-compatible backend checks.

## What the User Does

1. Logs in with email and password.
2. Receives a JWT access token.
3. Uses the app normally until the token expires.
4. Refreshes the token silently through the backend.
5. Gets blocked if they try to access another tenant's data.

## Real-Life Example

A finance assistant in Bangalore logs into the system to review lunch receipts. The assistant can see receipts inside their own tenant only, while the CFO can also view approval reports and policy violations.

## How It Works

- The backend verifies the password against the stored hash.
- JWT claims include `user_id`, `tenant_id`, and `role`.
- Middleware reads the token and sets tenant-scoped database context.
- PostgreSQL row-level security enforces tenant isolation.
- Redis stores refresh token state and invalidation data.

## Backend Flow

- Login endpoint receives email and password.
- System validates credentials.
- JWT access token and refresh token are signed.
- Middleware attaches role and tenant information to each request.
- Authorization rules decide whether the route is allowed.

## Roles

- `admin`: workspace owner, full access
- `manager`: approves and reviews team spend
- `user`: submits and edits own expenses

## Data Touchpoints

- `users`
- `tenants`
- `user_sessions`
- `audit_logs`
- Redis refresh token store

## Acceptance Checklist

- [x] Login with email and password.
- [x] Issue JWT access and refresh tokens.
- [x] Protect routes by role.
- [x] Prevent cross-tenant access.
- [x] Refresh expired access tokens.
- [x] Log sign-in and sign-out events.

## Progress Notes

- Implemented in the login page plus `POST /api/auth/login` and `POST /api/auth/refresh`.
- This story is the security gate for all other stories.
