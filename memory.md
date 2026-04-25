# Spendly Memory

Purpose: compact project memory for faster agent context loading with fewer tokens.
Last updated: 2026-04-25

## What This Project Is

- Spendly is a multi-tenant expense management app built on Next.js App Router.
- Tenancy is workspace/tenant scoped and routed by tenant slug (subdomain pattern).
- Current codebase includes implemented auth, core workspace pages, receipt upload/review APIs, policy endpoints, and team endpoints.

## Runtime Stack

- Framework: Next.js 16.2.3 (App Router), React 18.3, TypeScript.
- Styling/UI: Tailwind v4, shadcn-style UI components in components/ui.
- Auth crypto: jose (JWT), bcrypt.
- Data: PostgreSQL (pg) + Redis + Bull.
- AI/Parsing: Groq SDK, transformers, pdf-parse, sharp.

## High-Signal Folder Map

- app/: routes and API handlers.
- app/api/auth/: bootstrap, login, logout, refresh, signup.
- app/api/receipts/: upload and review flows.
- app/api/policies/: policy route.
- app/api/teams/: team and invite routes.
- app/workspace/: authenticated UI shell and feature pages.
- components/: shared UI, auth form, workspace shell/nav.
- lib/auth/: cookie and token utilities.
- lib/middleware/auth.ts: server auth context helpers.
- lib/repositories/: DB access (auth, receipts, policies, teams).
- lib/utils/tenant-host.ts: tenant URL + cookie domain logic.
- proxy.ts: request interception (Next.js proxy replacement for middleware.ts).
- database/spendly_schema.local.sql: local schema reference.
- logs/: development/progress/error logs written by custom logger.

## Auth + Routing Model (Critical)

- Access token cookie name: accessToken.
- Refresh token cookie name: refreshToken.
- Login/signup returns workspaceUrl (tenant host) and sets cookies.
- bootstrap endpoint sets auth cookies on target origin during cross-origin redirect flow.
- proxy.ts only matches: /, /login, /sign-up.
- /workspace protection currently enforced in app/workspace/layout.tsx via getServerAuthContext() and redirect('/login').
- Subdomain dev expectation: <tenantSlug>.localhost:3000/workspace.

## Common Gotchas

- Host mismatch causes apparent auth loops:
  - logging in on one host and opening workspace on another can drop auth context.
  - ex: localhost vs <slug>.localhost.
- If login fails server-side, cookies are never issued.
- Historical known failure in logs: SQL error for missing column trial_ends_at on stale DB schemas.
- README/IMPLEMENTATION include planning/legacy notes; verify against current code before changes.

## Fast Working Set (Read These First)

- proxy.ts
- app/workspace/layout.tsx
- components/auth-form.tsx
- app/api/auth/login/route.ts
- app/api/auth/bootstrap/route.ts
- lib/auth/cookies.ts
- lib/utils/tenant-host.ts
- lib/middleware/auth.ts
- lib/repositories/authRepository.ts
- package.json

## Day-to-Day Commands

- npm run dev
- npm run lint
- npm run test
- npm run test:api
- npm run db:setup
- npm run db:seed
- npm run db:validate
- npm run story:status
- npm run log:daily

## Token-Efficient Investigation Strategy

- Start with package.json scripts + target route/component + matching repository/helper files.
- Prefer grep/file search for symbols before broad file reads.
- Read only touched feature slice files unless debugging cross-cutting issues.
- Use logs/development.log for auth and route flow confirmation.
- Treat docs as secondary to source of truth in app/, lib/, and database schema.

## Current Reliability Notes

- Next.js version in this repo uses proxy.ts conventions; avoid reintroducing middleware.ts patterns.
- Lint may include unrelated pre-existing issues; validate touched files first.

## If You Need to Onboard Quickly

1. Run npm run dev.
2. Verify auth path: /login -> workspaceUrl -> /workspace.
3. Check host consistency (tenant subdomain vs localhost).
4. Inspect app/workspace/layout.tsx and proxy.ts for redirect behavior.
5. Confirm DB schema compatibility if auth endpoints fail.
