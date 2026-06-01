# India GST & Compliance Reports Story

**Status:** In Progress  
**Story Type:** Compliance  
**Real-life reference:** A finance manager at month-end exports a "GST-Ready Report" PDF with CGST/SGST/IGST breakdown, hands it to the accountant, and they use it to file GSTR-1 in minutes instead of hours.

## Why This Exists

For India-based teams, GST compliance is not optional. Spendly automatically captures tax info from receipts and generates compliance-ready reports without the e-invoice API (which requires live IRN generation). This story focuses on **custom report generation** that accountants can use.

## What the User Does

1. End of month → Workspace sidebar → "GST export".
2. Select period (e.g., April 1-30).
3. Click "Generate PDF".
4. PDF shows:
   - Total spending: ₹48,200
   - CGST: ₹2,410
   - SGST: ₹2,410
   - IGST: ₹0
   - Breakdown by vendor (with GSTIN if captured).
   - Summary by category.
5. Download PDF → email to accountant → accountant uses for GSTR-1.

## Real-Life Example

BluePeak Studio (GSTIN: 27ABCDE1234X1Z0) spends ₹48,200 in April:

- **Travel**: ₹18,000 (mostly from airlines, IGST 5% = ₹900).
- **Office Supplies**: ₹12,000 (from local vendor, SGST 5% = ₹600, CGST 5% = ₹600).
- **Meals**: ₹8,200 (local restaurants, SGST 5% = ₹410, CGST 5% = ₹410).
- **Software**: ₹10,000 (digital purchase, IGST 18% = ₹1,800).

Spendly export shows all of this, grouped by tax type (CGST, SGST, IGST), ready for accountant to file GSTR-1. No manual spreadsheet work.

### UI Behavior

- When the date range changes, the summary refreshes automatically after the range is valid.
- Export supports PDF via browser print, plus CSV and HTML download formats for different handoff workflows.
- GSTIN in the report header falls back to the tenant record first, then environment configuration, then a visible "Not configured" state.

## How It Works

### Data Capture (During Receipt Upload)

1. Receipt parser extracts GST info:

   ```json
   {
     "vendor_name": "Air India",
     "amount": 18000,
     "gst_rate": 5,
     "gst_type": "IGST", // or "CGST+SGST"
     "gst_amount": 900,
     "vendor_gstin": "27AAAA0001A2Z5" // if available
   }
   ```

2. Store in `receipts` table:
   - `tax_amount` (total GST)
   - `gst_rate` (%, e.g., 5)
   - `parsed_data.gst_type` (CGST/SGST/IGST)
   - `parsed_data.vendor_gstin` (if extracted)

### Report Generation

1. **Query**:
   - Select all receipts for period (Apr 1-30).
   - Group by: GST type (IGST, CGST+SGST), category, vendor.
   - Sum: amount, tax, by category.

2. **Render PDF**:
   - Company header (name, GSTIN, address).
   - Period: Apr 1-30, 2026.
   - **Summary Table**:
     | Category | Total | CGST | SGST | IGST |
     | Meals | ₹8,200 | ₹410 | ₹410 | — |
     | Travel | ₹18,000 | — | — | ₹900 |
     | Office | ₹12,000 | ₹600 | ₹600 | — |
     | Software | ₹10,000 | — | — | ₹1,800 |
     | **Total** | **₹48,200** | **₹1,010** | **₹1,010** | **₹2,700** |
   - **Detail Table** (by vendor):
     | Vendor | Category | Amount | Tax Type | Tax % | Tax Amt |
     | Starbucks | Meals | ₹520 | CGST+SGST | 5% | ₹52 |
     | Air India | Travel | ₹18,000 | IGST | 5% | ₹900 |
     | ... | ... | ... | ... | ... | ... |

   - **Footer**: "This report is for GSTR-1 filing purposes. Hand to accountant. Generated [date/time]."

3. **Download**: User downloads PDF, emails to accountant, accountant manually enters in GSTR-1 dashboard (no live API).

### Policy Rules (Admin Setup)

Admin can set simple category-based limits:

```
{
  "Meals": { "daily_limit": ₹800, "monthly_limit": ₹10,000, "requires_note": true },
  "Travel": { "monthly_limit": ₹50,000, "requires_approval": true },
  "Office": { "daily_limit": ₹5,000, "no_limit": false }
}
```

UI: Simple form with category + limit. No complex rule engine (keep it simple for MVP).

## Backend Flow

```
1. GET /api/compliance/gst-report?start=2026-04-01&end=2026-04-30
   └─ Validate user is admin/manager.
   └─ Query receipts in period.
   └─ Aggregate by GST type, category, vendor.

2. POST /api/compliance/gst-report/export
   └─ Call PDF generation service.
   └─ Return PDF file.

3. POST /api/policies/validate
   └─ Check receipt against policy rules.
   └─ Return violations (if any).
```

### PDF Generation

- Use library: `pdfkit` (Node.js) or `puppeteer` (HTML → PDF).
- Template: HTML + CSS (Tailwind) → PDF via Puppeteer.
- Header + tables + footer in PDF.

## Data Touchpoints

- `receipts` (GST data, amounts)
- `expense_reports` (grouping by report period)
- `expense_policies` (category limits)
- `audit_logs` (export timestamps, compliance review trails)

## Frontend Components

- **Dedicated GST Workspace**: Sidebar link opens a focused export page with summary, presets, and history.
- **Export Button**: Dedicated GST workspace → "Generate export".
- **Period Selector**: Date range picker (start/end date).
- **Category Filters** (optional): Checkbox to include/exclude categories.
- **Generate Button**: Triggers report.
- **Download Link**: PDF ready, click to download.
- **Export History**: Recent saved exports with timestamps and saved-file links.
- **Policy Rules Editor** (Admin only):
  - Category dropdown.
  - Daily/monthly limits (text inputs).
  - "Requires approval" checkbox.
  - "Requires note" checkbox.

## Acceptance Checklist

- [ ] Receipt parser extracts GST info (rate, amount, type).
- [ ] GST type detected: IGST or CGST+SGST.
- [ ] Vendor GSTIN parsed (if available).
- [ ] Policy rules admin UI (set category limits).
- [ ] Policy validation on receipt submission.
- [x] GST report query (date range, aggregation).
- [ ] PDF generation (company header, summary, detail tables).
- [ ] PDF download link.
- [ ] CSV export download.
- [x] Export audit trail (log when report generated/exported).
- [x] Mobile-friendly export UI.
- [x] Category grouping in reports.
- [x] Tax type breakdown (CGST vs. SGST vs. IGST).
- [x] Auto-refresh summary on date change.
- [x] GSTIN fallback handling in report header.
- [x] Dedicated GST workspace page.
- [x] Export history table.

## Progress Notes

- **No E-Invoice API**: Unlike some compliance solutions, we don't use e-invoice API for live IRN. Instead, generate custom PDFs for accountant use.
- **Why?**: Simpler, no licensing, no live API dependency, works offline.
- **Accountant Workflow**: They manually enter GSTR-1 on tax.gov.in. Spendly just provides the summary.
- **Future**: Can add live GSTR-1 filing API integration later if demand warrants.
- **Testing**: Test with real Indian receipts (various GST rates: 0%, 5%, 12%, 18%, 28%).
- **Compliance**: Audit trail of who exported what, when. Important for compliance review.
- **Workspace UI**: GST export moved to a dedicated workspace page with sidebar navigation, summary presets, and fallback empty states.

## Nice-to-Haves (v2)

- GSTR-2A matching (automatic import from GSTR-2A dashboard).
- Quarterly/annual summaries.
- Reconciliation view (receipts vs. bank statement).
- Multi-GSTIN support (if company has multiple entities).
