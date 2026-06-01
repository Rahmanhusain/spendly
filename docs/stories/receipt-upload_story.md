# Receipt Upload & Smart Parsing Story

**Status:** Done  
**Story Type:** Core Feature  
**Real-life reference:** A manager snaps a restaurant receipt with their phone, uploads it, and instantly sees the amount, date, category, and GST breakdown—plus a warning if it exceeds their meal limit.

## Why This Exists

Receipts are the atomic unit of expense tracking. This story makes receipt capture frictionless (mobile-first), extraction accurate (AI parsing), and feedback instant (real-time policy checks). No manual data entry.

## What the User Does

1. Opens Spendly → dashboard → "Upload Receipt" button.
2. Drags PDF or image into the drop zone, or uses the "Choose file" button.
3. Adds a mandatory contextual note before parsing submission.
4. App shows parsing submission state and status.
5. Sees extracted data:
   - Vendor: "Starbucks, Singapore"
   - Amount: ₹520
   - Date: 2026-04-14
   - Category: **Meals** (auto-suggested)
   - GST: ₹52 (SGST 5%)
6. **Instant feedback**: 🟢 "Within daily meal limit (₹800)".
7. User submits with note → receipt is stored with parsing metadata and moves to draft or needs review based on confidence.
8. Can then add to a report or submit as standalone.

## Real-Life Example

Sarah uploads a ₹850 lunch receipt. System instantly shows: ₹850, Meals (suggested), SGST ₹89. Then: 🔴 **"Exceeds daily meal limit by ₹50"**. Sarah can:

- Adjust the amount if there was a mistake.
- Add a note: "Client entertainment, approved by Ali."
- Submit anyway (manager can revisit in workflow).

Note is mandatory because policy checks may be per-person while a receipt may include multiple people.

No server call delays—feedback is **instant** (client-side config + server-side validation).

## How It Works

### Upload Flow

1. **Client**: User selects file (drag-drop or choose file button).
2. **Validation**: Check file type (JPG, PNG, PDF), size (<10MB).
3. **Upload**: POST to `/api/receipts/upload` with multipart form-data.
4. **Server**:
   - Save file locally or to CDN.
   - Queue async job: `receipt-processor` agent.
5. **File Storage**:
   - Local: `public/uploads/{tenant_id}/{user_id}/{file_id}.{ext}`
   - CDN (optional for v2): S3, GoogleCloud, etc.

### AI Parsing (Server-Side, Async)

1. **OCR Stage**:
   - Use Groq LLM or local TensorFlow to extract text from image/PDF.
   - Output: Raw text array.

2. **Parse Stage** (LLM call to Groq):

   ```
   Input: "STARBUCKS SINGAPORE 2026-04-14 LATTE ₹520 GST 5%"
   Output: {
     "vendor_name": "Starbucks, Singapore",
     "amount": 520,
     "currency": "INR",
     "receipt_date": "2026-04-14",
     "gst_rate": 5,
     "gst_amount": 26,
     "category": "meals",
     "confidence_score": 0.95
   }
   ```

3. **Store Parsed Data**:
   - Save to `receipts.parsed_data` (JSONB).
   - Save `confidence_score`.
   - If score < 0.7, flag for manual review.

### Duplicate Detection

- On parse completion, check:
  - Same vendor + amount + date within last 7 days = suspected duplicate.
  - Flag `receipts.is_duplicate = true`.
  - Suggest user: "Similar receipt found on [date]. Is this a duplicate?"
- User can confirm → archive one.

### Real-Time Policy Check

1. **Client-side** (instant feedback):
   - Load policy rules from API (cached).
   - Calculate: Does amount exceed category limit (meals, travel, etc.)?
   - Show green ✓ or red ✗ immediately.

2. **Server-side** (validation):
   - On submission, re-validate policy.
   - Store policy check result in `audit_logs` or receipt.

### Category Auto-Suggestion

- LLM returns category for receipt (Meals, Travel, Office, Client Entertaining, etc.).
- User can override before submitting.
- Categories stored in policy rules for validation.

## Backend Flow

```
1. POST /api/receipts/upload
   └─ Validate user + tenant.
   └─ Save file to disk.
   └─ Queue Bull job: receipt-processor.
   └─ Return receipt ID (status: "processing").

2. Bull Job: receipt-processor
   └─ Call Groq LLM: extract text + parse.
   └─ Store parsed_data in database.
   └─ Run duplicate detection.
   └─ Store confidence_score.
   └─ If score < 0.7, flag for manual review.
   └─ Emit WebSocket event: receipt ready.

3. GET /api/receipts/{id}
   └─ Return receipt + parsed data (for client preview).

4. POST /api/receipts/{id}/validate
   └─ Server re-validates policy.
   └─ Returns: violations (if any).

5. POST /api/receipts/{id}/confirm
   └─ User confirms extraction.
   └─ Set status: "draft" (ready to add to report).
```

## Data Touchpoints

- `receipts` (main receipt record)
- `receipts.parsed_data` (JSONB: vendor, amount, date, gst, category, etc.)
- `expense_policies` (category limits)
- `audit_logs` (policy checks, uploads)
- File system or CDN (images/PDFs)

## Frontend Components

- **Upload Button**: Dashboard + receipts page.
- **Drag-Drop Zone**:
  - Supports JPG, PNG, PDF files.
  - Show progress bar (% uploaded).
- **Choose File Button**:
  - Opens native file picker for JPG, PNG, and PDF.
- **Mandatory Note Field**:
  - User must provide context (for example, attendee count or client purpose).
  - Note is attached to parsing metadata and policy interpretation.
- **Parsed Data Preview**:
  - Vendor, amount, date, category (editable).
  - GST breakdown (read-only).
  - Confidence score (0-100%).
  - Duplicate warning (if detected).
- **Policy Feedback**:
  - Green ✓ "Within limits" or Red ✗ "Exceeds limit".
  - Show: current + limit.
- **Confirm Button**: Lock in data, move to drafts.

## Acceptance Checklist

- [x] Drag-drop upload zone.
- [x] Choose-file upload button.
- [x] Camera upload removed from workflow.
- [x] File validation (type, size).
- [x] OCR + LLM parsing (Groq integration).
- [x] Parsed data stored (vendor, amount, date, category, GST).
- [x] Confidence score calculated.
- [ ] Duplicate detection (same vendor + amount + date).
- [x] Category auto-suggestion.
- [ ] Editable parsed fields (user can correct).
- [ ] Real-time policy check (instant feedback).
- [ ] Policy violation warning UI.
- [x] GST breakdown shown correctly.
- [x] Manual review flag (confidence < 70%).
- [x] File storage (local or CDN).
- [ ] Async parsing (Bull job queue).
- [ ] WebSocket notification when done (optional).
- [x] Mandatory contextual note for parse submission.
- [x] Mobile-responsive upload UI.
- [ ] Offline queue (upload when back online).

## Progress Notes

- **Dependencies**: Team & Org Setup (multitenancy) + Expense Policies (for validation).
- **AI Model**: Groq LLM for parsing; TensorFlow Lite alternative for offline-capable (v2).
- **File Storage**: Start with local disk (`public/uploads/`). Migrate to CDN later.
- **Parsing Speed**: Groq typically <1 sec. Show spinner to user.
- **Duplicate Detection**: Simple heuristic (same vendor + amount + date). Can be smarter (fuzzy match) in v2.
- **Error Handling**: If parse fails, show "Unable to extract. Please verify manually" + edit form.
- **Policy Context Rule**: Notes are required so per-person policy limits can be interpreted against group receipts.
