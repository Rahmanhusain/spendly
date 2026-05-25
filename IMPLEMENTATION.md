# Spendly Implementation Guide

Project Version: 0.2.0  
Last Updated: April 14, 2026  
Status: Planning and Foundation Setup

## 1) Project Idea

Spendly is an India-first, mobile-first expense management SaaS for teams.

Core idea:

- Employees upload receipts quickly from phone or desktop.
- AI extracts expense data automatically (amount, date, vendor, category, GST breakup).
- Policy checks happen instantly (for example, meal limit exceeded warning).
- Managers review and approve expense reports with comments.
- Finance/admin exports GST-ready compliance reports without e-invoice API dependency.

Why this product exists:

- Most small and mid teams still run expense workflows across WhatsApp, email, and spreadsheets.
- Approvals are slow because context is scattered.
- GST preparation is manual and time-consuming.
- Existing tools can be expensive, complex, or not India-centric.

Target users:

- Founders and admins (set rules, monitor spend)
- Managers (approve team reports)
- Employees (submit receipts and reports)
- Accountants (consume GST-ready exports)

Pricing model:

- 15-day free trial for every workspace
- Full feature access during trial (teams, unlimited receipts, approvals, compliance, analytics)

## 2) Current Repository Reality (Analysis)

Based on current repository files:

Implemented now:

- Next.js app scaffold exists in app layout and page
- Story planning is detailed in docs/stories
- Progress logging scripts exist:
  - scripts/log-feature.js
  - scripts/daily-summary.js
  - scripts/story-status.js
- Logger utility exists at lib/utils/logger.ts
- Environment template exists at .env.example
- Report collaboration features implemented: threaded comments, `mentioned_user_ids` on comments, audit trail APIs, `request-info` workflow, `mark-paid` endpoint, and `lib/utils/notifications.ts` plus the frontend `expense-report-workspace` panel.

Not implemented yet (major product features still pending):

- Full real-time presence layer for collaboration (NestJS socket service integration planned)
- Some automated worker orchestration for large-scale parsing and reconciliation
- Additional end-to-end tests and expanded API coverage for every story

Conclusion:

- The repo is at strong planning stage with logging scaffolding.
- Main engineering work is still to be built feature-by-feature.

## 3) Story-Driven Build Order (Single Source of Truth)

Implement stories in this exact dependency order:

1. docs/stories/create-account_story.md
2. docs/stories/authenticationand_authorizaton_story.md
3. docs/stories/team-setup_story.md
4. docs/stories/receipt-upload_story.md
5. docs/stories/policy-validation_story.md
6. docs/stories/expense-report_story.md
7. docs/stories/approval-workflow_story.md
8. docs/stories/team-collaboration_story.md
9. docs/stories/gst-compliance_story.md
10. docs/stories/dashboard_story.md

Recommended milestones:

- Milestone A (Foundation): Stories 1 to 3
- Milestone B (Core Expense Flow): Stories 4 to 7
- Milestone C (Compliance and Insight): Stories 8 to 10

## 4) Technical Architecture

Stack:

- Frontend: Next.js 16, React 19, Tailwind CSS
- Backend: Next.js route handlers
- Database: PostgreSQL (tenant-scoped)
- Cache and queue: Redis + Bull
- AI parsing: Groq API
- Auth: JWT access and refresh tokens
- Testing: Jest + API tests

High-level flow:

1. User action in UI
2. Route handler validates auth and tenant scope
3. Business logic runs (possibly queueing async jobs)
4. Data persisted in PostgreSQL
5. Logs written for operations and audit
6. Response returned to UI

## 4.1) Technical Implementation Blueprint

This section defines how to implement the system in code, not just what to build.

### Backend Module Layout

Use this layering pattern for each feature:

- Route Handler Layer: request parsing, auth guard, role guard, response formatting
- Service Layer: business logic and orchestration
- Repository Layer: database operations with tenant-safe queries
- Integration Layer: external providers (Groq, email, PDF export, storage)

Suggested internal structure:

- app/api/<feature>/route.ts: route handlers
- lib/services/<feature>Service.ts: business logic
- lib/repositories/<feature>Repository.ts: SQL and persistence
- lib/integrations/<provider>/\*.ts: provider clients
- lib/validators/\*.ts: zod validation schemas

### Request Lifecycle (Standard)

Every API route should execute in this order:

1. Generate request_id
2. Parse and validate input
3. Verify JWT and extract tenant_id and role
4. Check authorization policy
5. Call service method
6. Persist changes through repository
7. Write audit and operational logs
8. Return typed response with stable error format

Standard error response shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid receipt date",
    "request_id": "req_abc123"
  }
}
```

### Database Implementation Rules

Repository rules:

- Never run raw table query without tenant_id filter
- Use parameterized SQL only
- Wrap multi-step writes in transactions
- Soft-delete sensitive records when required by compliance

Transaction-required operations:

- Register tenant + first admin user
- Create report + add report items
- Approve/reject report + audit log write
- Import bank CSV + reconciliation decisions

Indexing priorities:

- receipts: (tenant_id, receipt_date), (tenant_id, user_id), (tenant_id, amount)
- expense_reports: (tenant_id, status), (tenant_id, user_id)
- approval_workflows: (tenant_id, approver_id, status)
- audit_logs: (tenant_id, created_at)

### Auth and Tenant Guard Middleware

Implement reusable middleware utilities:

- requireAuth(): verifies access token and sets auth context
- requireRole(...roles): enforces role-based access
- withTenantScope(): verifies tenant_id exists and injects into repository context

Auth context object shape:

```ts
type AuthContext = {
  requestId: string;
  userId: string;
  tenantId: string;
  role: "employee" | "manager" | "admin";
};
```

### Queue and Worker Implementation

Queue names:

- receipt-parse-queue
- policy-check-queue
- weekly-summary-queue

Worker responsibilities:

- receipt parser worker: OCR and structured field extraction
- policy worker: evaluate limits and annotate violations
- summary worker: weekly digest generation and email dispatch

Job payload example:

```json
{
  "job_type": "receipt_parse",
  "tenant_id": "tenant_1",
  "user_id": "user_9",
  "receipt_id": "receipt_22",
  "file_path": "public/uploads/tenant_1/user_9/receipt_22.jpg"
}
```

Retry policy:

- max attempts: 3
- exponential backoff: 2s, 10s, 30s
- dead-letter logging on final failure

### Receipt Parsing Technical Flow

Upload path:

1. Validate file type and size
2. Store file in tenant-scoped path
3. Create receipt row with status=processing
4. Push receipt_parse job
5. Worker calls AI parser
6. Save parsed_data and confidence_score
7. Trigger duplicate check and policy check
8. Mark status as draft or needs_review

Minimum parsed_data schema:

```json
{
  "vendor_name": "string",
  "amount": 0,
  "receipt_date": "YYYY-MM-DD",
  "category": "travel|meals|office|other",
  "gst_rate": 0,
  "gst_type": "CGST_SGST|IGST|NONE",
  "tax_amount": 0,
  "confidence_score": 0
}
```

### Policy Engine Technical Rules

Policy evaluation should support:

- daily category limit
- monthly category limit
- requires_approval flag
- requires_note flag

Policy result contract:

```json
{
  "is_compliant": false,
  "severity": "warning",
  "violations": [
    {
      "rule": "MEALS_DAILY_LIMIT",
      "actual": 920,
      "limit": 800,
      "difference": 120
    }
  ]
}
```

### Report and Approval Technical Flow

Report state machine:

- draft -> submitted -> approved -> paid
- draft -> submitted -> rejected -> draft
- submitted -> info_requested -> submitted

Comment model requirements:

- report_id
- optional receipt_id
- author_user_id
- body
- created_at

Approval endpoint rules:

- manager/admin only
- must verify same tenant
- must write audit log with before and after status

### GST Export Technical Flow

Implementation steps:

1. Query receipts by tenant and date range
2. Aggregate totals by GST type and category
3. Build normalized report object
4. Render HTML template
5. Convert to PDF
6. Log export action in audit log

Output includes:

- company header (name, GSTIN, address)
- period summary
- CGST, SGST, IGST totals
- vendor-level line items

### Dashboard Query Strategy

Dashboard services should provide:

- metrics summary endpoint
- chart series endpoint
- recent activity endpoint

Caching strategy:

- cache key pattern: dashboard:<tenant_id>:<period>
- TTL: 300 seconds
- invalidate on receipt create, report status change, policy update

### Frontend Implementation Strategy

UI architecture:

- app/(auth): login/register pages
- app/(dashboard): protected pages and layout
- components/ui: reusable cards, tables, forms, charts
- components/expense: receipt upload, report builder, approval panels

State management recommendations:

- Use server actions or route handlers for write operations
- Use React Query or SWR for cached data fetching
- Keep auth and tenant context in a single provider

Minimum pages to implement first:

- /register
- /login
- /dashboard
- /receipts
- /reports
- /policies

### Testing Implementation Matrix

Required tests per feature:

- Validator tests (input schemas)
- Service tests (business rules)
- Repository tests (tenant-safe query behavior)
- API tests (auth, role, tenant access)

Critical negative tests:

- cross-tenant access attempt must return 403
- employee approving report must return 403
- invalid JWT must return 401
- malformed upload must return 400

### Observability and Metrics

Track these metrics from day one:

- requests_total by endpoint and status
- request_duration_ms p50 p95 p99
- queue_job_duration_ms by queue name
- receipt_parse_success_rate
- policy_violation_rate
- report_approval_time_minutes

Suggested alert thresholds:

- parse failure rate > 10 percent over 15 minutes
- API error rate > 5 percent over 10 minutes
- queue lag > 2 minutes for receipt-parse-queue

## 4.2) UI Guide (SaaS Product Style)

This product should look and behave like a modern B2B SaaS app: fast, clear, and operationally reliable.

### UX Goals

- Reduce clicks to complete core actions (upload, submit, approve, export).
- Show critical business state immediately (pending approvals, violations, reimbursement status).
- Keep role-based experiences clear (employee, manager, admin).
- Make every key metric actionable with drill-down.

### App Shell Layout

Desktop:

- Left sidebar navigation: Dashboard, Receipts, Reports, Approvals, Policies, GST, Reconciliation, Settings.
- Top bar: tenant identity, search, notifications, user profile.

Mobile:

- Bottom nav for high-frequency flows.
- Slide menu for secondary screens.
- Sticky primary action button for upload and quick actions.

### Design System Rules

Visual hierarchy:

- Primary action: one per page (high contrast button).
- Secondary actions: neutral style.
- Destructive actions: danger style with confirmation.

Spacing:

- 8-point spacing scale (8/16/24/32).
- Consistent card and table paddings across pages.

Typography:

- Keep heading and body sizes consistent by page type.
- Strong readability for data-heavy tables.

Status colors:

- Success for approved and completed states.
- Warning for policy risk and pending review.
- Error for failures and rejected state.
- Neutral for draft and informational state.

### Core SaaS Components

Required reusable components:

- PageHeader (title, subtitle, actions)
- MetricsCard (value, trend, status)
- FilterBar (date, status, assignee, category)
- DataTable (sorting, filtering, pagination, row actions)
- StatusBadge (draft, submitted, approved, rejected, paid)
- RightDrawer (inline detail edits)
- EmptyState (guidance + CTA)
- ErrorState (reason + retry)

### Dashboard UX Pattern

- Row 1: key metrics (spent, budget left, pending approvals, violations)
- Row 2: charts (trend and category split)
- Row 3: recent activity and quick actions
- Every card and chart point should open filtered detail views.

### Receipt and Approval UX Pattern

Receipt upload:

- Drag-and-drop and choose-file upload support.
- Parse preview with editable fields before confirmation.
- Policy warning shown before submit.

Approval queue:

- Prioritized list with status and aging.
- Report detail with threaded comments.
- Sticky action bar: approve, reject, request info.

### UX Quality Checklist

Before a UI story is marked done:

- All async actions include loading, success, and error states.
- No role can access hidden actions via direct URL.
- Tables and charts match backend data exactly.
- Mobile layouts tested for upload and approvals.
- Accessibility baseline met (keyboard, focus, labels, contrast).

### Enhanced Interaction Standards (Popups and Operation Feedback)

Every user operation must provide clear feedback. No silent actions.

Use these interaction types consistently:

- Toast: short success and info updates (auto-dismiss).
- Modal: destructive confirmation, important warnings, irreversible actions.
- Drawer: non-destructive edit and detail flows.
- Inline message: field-level validation and small contextual warnings.
- Progress UI: upload and long-running tasks with percentage or step state.

Required behavior by operation type:

- Create actions (create report, add policy):
  - Show loading state on button.
  - Show success toast with next action link.
  - On failure show inline error and retry CTA.
- Update actions (edit receipt, update role):
  - Show optimistic update when low risk.
  - Revert on failure and show error toast.
- Destructive actions (delete, revoke, reject):
  - Always show confirmation modal.
  - Require explicit confirmation label.
  - Show completion toast and audit trail hint.
- Async jobs (receipt parsing, exports):
  - Show queued or processing badge immediately.
  - Provide live status polling or refresh CTA.
  - Show completion toast and destination link.

Confirmation modal content rules:

- Title: clear action intent.
- Body: what will change and if recoverable.
- Primary button: explicit verb (Delete policy, Reject report).
- Secondary button: cancel.
- Optional typed confirmation for critical actions.

Toast rules:

- Success: 2.5 to 4 seconds auto-dismiss.
- Error: persistent until dismissed or corrected.
- Max 1 stacked toast per category to avoid noise.

### Operation State Matrix (Must Implement)

For each operation track and render:

- idle
- loading
- success
- error

For long tasks add:

- queued
- processing
- completed
- failed

Examples:

- Receipt upload: idle -> uploading -> parsing -> completed or failed.
- GST export: idle -> generating -> ready or failed.
- Approval action: idle -> saving -> approved/rejected or failed.

### Professional SaaS UI Patterns

Adopt these patterns across the app:

- Bulk actions with selection count and clear undo expectations.
- Empty states with specific CTA (Upload first receipt, Create policy).
- Sticky action bar on long detail screens.
- Keyboard shortcuts for high-frequency actions.
- Time stamps and actor names on every status transition.
- "Last updated" indicator on dashboard and reports.

### UX Anti-Patterns to Avoid

- Blocking full-page spinners for small actions.
- Generic error text without cause or next step.
- Hidden destructive actions without confirmation.
- Color-only status indication without labels.
- Multiple competing primary buttons in one view.

## 4.3) Tech Stack Used (and Why)

### Frontend Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Recharts

Why:

- Fast product iteration with one full-stack repo.
- Strong rendering model for performance and UX control.
- Built-in compatibility with API route handlers.

### Backend Stack

- Next.js route handlers
- Node.js runtime
- Zod for validation

Why:

- Keeps API and product in one deployable surface.
- Lower operational overhead for MVP and early scale.

### Data and Infrastructure

- PostgreSQL (primary relational store)
- Redis (cache + queue coordination)
- Bull (background jobs)

Why:

- Transaction safety for approval and compliance workflows.
- Reliable async processing for parsing and email summaries.

### Security and Auth

- JWT access and refresh tokens
- bcryptjs for password hashing
- Tenant and role-based authorization

Why:

- Multi-tenant control with explicit guard rails.
- Predictable API authorization behavior.

### AI and Processing

- Groq SDK for extraction
- Sharp for image preprocessing
- Optional transformers fallback for future model strategy

Why:

- Fast extraction for receipt workflows.
- Flexible architecture for model quality improvements.

### Testing and Quality

- Jest
- Supertest
- ESLint

Why:

- Balanced speed and confidence for feature delivery.

### Operational Tooling

- scripts/log-feature.js
- scripts/daily-summary.js
- scripts/story-status.js
- logs/templates/\*

Why:

- Structured progress tracking and runtime debugging discipline.

## 5) Tenant Isolation and Security Rules

Non-negotiable rules:

- Every business table must include tenant_id
- Every query must filter by tenant_id
- JWT must include user_id, tenant_id, role
- Role guard enforced at route boundary
- Sensitive events logged in audit trail

Role model:

- employee: upload, submit, own view
- manager: team approvals and team expense visibility
- admin: full access including policy, reports, billing-level controls

## 6) Data Model (Core)

Essential tables:

- tenants
- users
- user_sessions (refresh token control)
- receipts
- expense_policies
- expense_reports
- expense_report_items
- approval_workflows
- comments (or equivalent JSON strategy)
- bank_transactions
- audit_logs

Receipt minimum fields:

- tenant_id, user_id
- vendor_name, amount, receipt_date, category
- gst_rate, tax_amount
- parsed_data JSON
- confidence_score
- is_duplicate, duplicate_of

## 7) API Roadmap by Story

Foundation APIs:

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/team/invite
- POST /api/team/accept-invite
- PATCH /api/team/users/{id}/role

Receipt and policy APIs:

- POST /api/receipts/upload
- GET /api/receipts/{id}
- POST /api/receipts/{id}/confirm
- POST /api/policies/validate
- GET /api/policies
- POST /api/policies

Report and approval APIs:

- POST /api/reports
- PATCH /api/reports/{id}
- POST /api/reports/{id}/submit
- POST /api/reports/{id}/approve
- POST /api/reports/{id}/reject
- POST /api/reports/{id}/comments

Compliance and analytics APIs:

- GET /api/compliance/gst-report
- POST /api/compliance/gst-report/export
- GET /api/dashboard/metrics
- GET /api/dashboard/charts
- GET /api/dashboard/activity
- POST /api/reconciliation/import-csv

## 8) Logging Strategy (What to Log and Why)

Logging goals:

- Track development progress clearly
- Debug failures quickly
- Capture auditable financial actions
- Measure API and job performance

Log files:

- logs/progress.log
- logs/development.log
- logs/errors.log
- logs/feature-completion.json
- logs/audit.log (recommended for business events)
- logs/api.log (recommended for request summary)

Template files created in repository:

- logs/templates/progress.log.template
- logs/templates/development.log.template
- logs/templates/errors.log.template
- logs/templates/api.log.template
- logs/templates/audit.log.template
- logs/templates/feature-completion.template.json

Log levels:

- INFO: normal operation events
- DEBUG: verbose technical details
- WARN: recoverable issues
- ERROR: failed operations
- FEATURE: story tracking updates
- MILESTONE: major completion points
- AUDIT: compliance-critical business actions

Required context keys for structured logs:

- request_id
- tenant_id
- user_id
- role
- route
- status_code
- duration_ms
- resource_type
- resource_id

## 9) Logging Templates

Use these templates consistently across scripts and app code.

Template A: General app log line

- [TIMESTAMP] [LEVEL] message | {json_context}

Example:

- [2026-04-14T10:00:00.000Z] [INFO] Receipt uploaded | {"request_id":"req_123","tenant_id":"t1","user_id":"u1","receipt_id":"r1"}

Template B: Feature progress log line

- [TIMESTAMP] [FEATURE] STATUS: Feature Name (optional_metadata)

Example:

- [2026-04-14T10:10:00.000Z] [FEATURE] IN_PROGRESS: Receipt Upload API (multipart + validation)

Template C: API request summary

- [TIMESTAMP] [API] METHOD PATH -> STATUS | {"request_id":"...","tenant_id":"...","duration_ms":123}

Template D: Error log

- [TIMESTAMP] [ERROR] message | {"request_id":"...","tenant_id":"...","stack":"..."}

Template E: Audit log (compliance)

- [TIMESTAMP] [AUDIT] action | {"tenant_id":"...","user_id":"...","resource_type":"report","resource_id":"...","before":{},"after":{}}

Template F: Job processing log

- [TIMESTAMP] [JOB] queue_name:job_name status | {"job_id":"...","tenant_id":"...","duration_ms":456}

## 10) Operational Logging Scenarios

Always log these actions:

- User login, logout, refresh
- Invite generated and accepted
- Receipt uploaded, parsed, manually corrected
- Duplicate detection result
- Policy validation result and exceptions
- Report submitted, approved, rejected, marked paid
- GST export generated and downloaded
- Reconciliation import and match decisions

Performance logging targets:

- API p95 under 500 ms for non-upload requests
- Parsing queue median under 3 s
- Dashboard metrics response under 2 s

## 11) Implementation Plan by Week

Week 1:

- Story 1 to 3
- Deliver auth, tenant isolation, role setup, invite flow

Week 2:

- Story 4 and 5
- Deliver upload pipeline, parse integration, policy engine v1

Week 3:

- Story 6 and 7
- Deliver report lifecycle and approval flow

Week 4:

- Story 8 and 9
- Deliver collaboration basics and GST exports

Week 5:

- Story 10 and 11
- Deliver dashboard analytics and reconciliation CSV flow

Week 6:

- Story 12
- PWA, dark mode, summary email, QA hardening

## 12) Definition of Done (Per Story)

A story is Done only when:

- Functional acceptance checklist is complete
- Tenant and role access tested
- Error and audit logs verified
- Unit/API tests added or updated
- Logs contain expected template entries
- Story status updated via npm run log:feature

## 13) Commands and Execution Workflow

Daily workflow:

1. npm run log:feature "Story Name" "STARTED"
2. Build feature with tests
3. npm run log:feature "Story Name" "IN_PROGRESS" "notes"
4. Complete and verify logs
5. npm run log:feature "Story Name" "COMPLETED" "time_spent"
6. npm run story:status
7. npm run log:daily

Useful commands:

- npm run dev
- npm run lint
- npm test
- npm run db:validate

## 14) Risks and Mitigations

Risk: Story overlap and duplicate implementation  
Mitigation: Follow sequence in section 3 and keep one active story at a time.

Risk: Tenant leakage in queries  
Mitigation: Mandatory tenant filters and tests for every endpoint.

Risk: AI extraction inconsistency  
Mitigation: Confidence threshold and manual correction path.

Risk: Compliance mismatch  
Mitigation: Immutable audit logs for policy and GST export actions.

## 15) Immediate Next Actions

1. Create auth route handlers and JWT middleware (stories 1 and 2)
2. Implement tenant-scoped user creation and invite flow (story 3)
3. Add receipt upload endpoint and file validation (story 4)
4. Add policy validation service and warning model (story 5)
5. Start report draft and submit endpoints (story 6)

This file is now the canonical implementation reference for the repository.
