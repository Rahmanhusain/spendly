# Policy Validation Story

**Status:** Planned  
**Story Type:** Controls and Rules  
**Real-life reference:** A finance team checks whether a meal receipt breaks the company spending limit before approving it.

## Why This Exists

Companies need custom rules for categories, limits, and exceptions. Spendly should flag policy problems early instead of waiting for a final review.

## What the User Does

1. Sets spending rules for the company.
2. Uploads or edits a receipt.
3. Sees policy warnings or blocks.
4. Adds a reason if an exception is needed.
5. Approvers review the policy result during approval.

## Real-Life Example

A startup in Bengaluru sets a meal limit of 800 INR per person per day. When an employee uploads a 1,900 INR dinner receipt, Spendly flags the policy breach and asks for manager review.

## How It Works

- Policy rules are stored as tenant-specific JSON.
- The backend compares each receipt to the active rules.
- Violations are classified by severity.
- The approval workflow uses the result to decide what happens next.

## Backend Flow

- Load active policy for the tenant.
- Inspect receipt amount, category, merchant, and date.
- Evaluate rule conditions.
- Return warnings or blocking errors.
- Write the evaluation to the audit log.

## Data Touchpoints

- `expense_policies`
- `receipts`
- `approval_workflows`
- `audit_logs`

## Acceptance Checklist

- [ ] Store tenant policy rules.
- [ ] Evaluate new receipts against rules.
- [ ] Show warnings and blocks.
- [ ] Support exception reasons.
- [ ] Connect results to approvals.

## Progress Notes

- This story is the policy layer of the core workflow.
- It should be ready before advanced reconciliation or optimization features.
