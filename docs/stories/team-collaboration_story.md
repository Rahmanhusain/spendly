# Team Collaboration Story

**Status:** Planned  
**Story Type:** Premium Collaboration  
**Real-life reference:** A finance manager, a department head, and a junior employee discuss the same expense report in real time.

**Status:** Done (partial)  
**Last Updated:** 2026-05-25  
**Story Type:** Advanced Feature

## Why This Exists

Spendly should feel like a shared workspace, not a slow approval queue. Teams need comments, presence, and shared context around spend decisions.

## What the User Does

1. Opens a shared expense report.
2. Adds comments or mentions another teammate.
3. Sees live updates from other reviewers.
4. Watches approval status change in real time.
5. Resolves disagreements without leaving the report screen.

## Real-Life Example

A startup team in Hyderabad is reviewing a client dinner receipt. The employee, manager, and finance lead all comment on the same report. The manager asks for context, finance checks policy limits, and the employee clarifies the meeting purpose.

## How It Works

- Live updates are handled in-app for the current MVP by refetching report activity after actions.
- Comments and approvals are persisted, and the timeline stays auditable.
- WebSocket/Redis broadcast can be added later if realtime presence becomes a product requirement.
- The report behaves like a shared workspace without requiring a separate realtime service.

## Backend Flow

- User opens a report.
- Server joins them to the report room.
- Edits are broadcast to other viewers.
- Comments and mentions are persisted.
- Approval events update the timeline immediately.

## Data Touchpoints

- `expense_reports`
- `approval_workflows`
- `audit_logs`
- Redis pub/sub

## Acceptance Checklist

- Recent implementation notes (2026-05-25):
- Threaded comments and mentions implemented in the report workspace (in-app notifications supported).
- Real-time presence (presence badges/unread markers) is planned and scoped for the next iteration.

## Progress Notes

- This story belongs to the premium collaboration tier.
- It becomes valuable only after core expense workflows are stable.
- Realtime transport is deferred; polling/refetch is enough for now.
