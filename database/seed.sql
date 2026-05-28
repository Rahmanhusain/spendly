-- =============================================================================
-- Spendly — Development Seed Script
-- =============================================================================
-- Workspace  : Vyns Global Pvt. Ltd.  (slug: vynsglobal)
-- Admin user : rahmanhusain899@gmail.com  / Rahman@1234  (role: admin)
-- Employee   : ritchiedennis793@gmail.com / Ritchie@1234 (role: employee)
-- Super-admin: rahmanhusain899@gmail.com  / Rahman@1234  (admin panel only)
--
-- Passwords are bcrypt-hashed (cost 12).
-- Run with:  psql $DATABASE_URL -f database/seed.sql
--
-- Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING for top-level rows.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Pre-computed bcrypt hashes (cost 12)
--    Rahman@1234  → $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5udem
--    Ritchie@1234 → $2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uAyICi8He
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. Super-admin (admin panel access — separate from workspace users)
-- ---------------------------------------------------------------------------
INSERT INTO super_admins (id, email, password_hash, name, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'rahmanhusain899@gmail.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5udem',
  'Rahman Husain',
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Tenant — Vyns Global Pvt. Ltd.
-- ---------------------------------------------------------------------------
INSERT INTO tenants (
  id, name, slug, plan, trial_ends_at, status,
  country_code, gstin, company_address, receipt_quota_monthly
)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Vyns Global Pvt. Ltd.',
  'vynsglobal',
  'trial',
  NOW() + INTERVAL '15 days',
  'active',
  'IN',
  '27AABCV1234F1Z5',
  '42, Nariman Point, Mumbai, Maharashtra 400021',
  999999
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Users — exactly two workspace users
--    u_admin    : rahmanhusain899@gmail.com  (admin — approves reports)
--    u_employee : ritchiedennis793@gmail.com (employee — submits reports)
-- ---------------------------------------------------------------------------
INSERT INTO users (
  id, tenant_id, email, password_hash,
  first_name, last_name, role, status, timezone, can_export_gst
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'rahmanhusain899@gmail.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5udem', --Reset via email
    'Rahman', 'Husain',
    'admin', 'active', 'Asia/Kolkata', TRUE
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'ritchiedennis793@gmail.com',
    '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uAyICi8He', --reset Via Email
    'Ritchie', 'Dennis',
    'employee', 'active', 'Asia/Kolkata', FALSE
  )
ON CONFLICT (tenant_id, email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Expense policy — default policy for the workspace
-- ---------------------------------------------------------------------------
INSERT INTO expense_policies (
  id, tenant_id, name, description, rules,
  is_default, status, version, created_by
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Standard Expense Policy',
  'Default policy for Vyns Global. Covers travel, meals, accommodation, and office supplies.',
  '{
    "maxAmountPerReceipt": 50000,
    "requiresApprovalAbove": 5000,
    "allowedCategories": [
      "Travel","Meals","Accommodation","Office Supplies","Software",
      "Training","Fuel","Utilities","Marketing","Miscellaneous"
    ],
    "mealLimit": 1500,
    "travelLimit": 20000,
    "accommodationLimit": 8000
  }'::jsonb,
  TRUE, 'active', 1,
  '20000000-0000-0000-0000-000000000001'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Receipts — 110 receipts
--    All owned by the employee (Ritchie).
--    The admin (Rahman) acts as approver only — he does not own receipts.
--    Categories, vendors, amounts, and dates are varied for realism.
--    GST uses standard Indian rates: 5%, 12%, 18%.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_tenant_id  UUID    := '10000000-0000-0000-0000-000000000001';
  v_employee   UUID    := '20000000-0000-0000-0000-000000000002';

  categories TEXT[]  := ARRAY[
    'Travel','Meals','Accommodation','Office Supplies','Software',
    'Training','Fuel','Utilities','Marketing','Miscellaneous'
  ];
  vendors    TEXT[]  := ARRAY[
    'IndiGo Airlines','Zomato Business','OYO Rooms','Amazon Business',
    'Zoho Corp','NIIT Training','HP Petrol Pump','BSES Rajdhani',
    'Meta Ads','Staples India','MakeMyTrip','Swiggy for Business',
    'Treebo Hotels','Flipkart Wholesale','Tally Solutions',
    'Coursera India','Indian Oil','Adani Electricity','Google Ads','Reliance Digital'
  ];
  gst_rates  NUMERIC[] := ARRAY[5, 12, 18];
  statuses   TEXT[]  := ARRAY[
    'draft','verified','verified','verified','needs_review'
  ];

  i          INT;
  r_id       UUID;
  r_category TEXT;
  r_vendor   TEXT;
  r_amount   NUMERIC(14,2);
  r_gst_rate NUMERIC(5,2);
  r_cgst     NUMERIC(14,2);
  r_sgst     NUMERIC(14,2);
  r_tax      NUMERIC(14,2);
  r_date     DATE;
  r_status   TEXT;
  r_num      TEXT;
BEGIN
  FOR i IN 1..110 LOOP
    r_id       := gen_random_uuid();
    r_category := categories[1 + ((i - 1) % 10)];
    r_vendor   := vendors[1 + ((i - 1) % 20)];
    r_amount   := ROUND((200 + (i * 397.3)::NUMERIC % 44800)::NUMERIC, 2);
    r_gst_rate := gst_rates[1 + ((i - 1) % 3)];
    r_cgst     := ROUND(r_amount * (r_gst_rate / 2) / 100, 2);
    r_sgst     := r_cgst;
    r_tax      := r_cgst + r_sgst;
    r_date     := CURRENT_DATE - ((i * 1.6)::INT % 180);
    r_status   := statuses[1 + ((i - 1) % 5)];
    r_num      := 'VG-' || LPAD(i::TEXT, 5, '0');

    INSERT INTO receipts (
      id, tenant_id, user_id,
      receipt_number, vendor_name, amount, currency, receipt_date,
      category, description,
      gst_rate, cgst_rate, sgst_rate, igst_rate,
      cgst_amount, sgst_amount, igst_amount, tax_amount,
      vendor_gstin,
      file_path, file_name, mime_type, file_size_bytes,
      extracted_text, confidence_score,
      status, is_duplicate
    )
    VALUES (
      r_id, v_tenant_id, v_employee,
      r_num, r_vendor, r_amount, 'INR', r_date,
      r_category, r_category || ' expense — ' || r_vendor,
      r_gst_rate, r_gst_rate / 2, r_gst_rate / 2, 0,
      r_cgst, r_sgst, 0, r_tax,
      '27AABCV' || LPAD(i::TEXT, 7, '0') || 'Z5',
      'receipts/seed/' || r_num || '.pdf',
      r_num || '.pdf', 'application/pdf', (50000 + i * 1234),
      'Seed receipt for ' || r_vendor || ' dated ' || r_date,
      0.92,
      r_status::receipt_status, FALSE
    )
    ON CONFLICT (tenant_id, receipt_number) DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Expense reports — 55 reports
--    All submitted by the employee (Ritchie).
--    All approved/rejected by the admin (Rahman).
--    Mix of statuses: draft, submitted, approved, rejected, paid, info_requested.
--    Each report gets 2 receipts attached.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_tenant_id  UUID   := '10000000-0000-0000-0000-000000000001';
  v_admin      UUID   := '20000000-0000-0000-0000-000000000001';
  v_employee   UUID   := '20000000-0000-0000-0000-000000000002';

  statuses   TEXT[] := ARRAY[
    'draft','submitted','submitted','approved','approved',
    'rejected','paid','info_requested','approved','submitted'
  ];

  i          INT;
  rep_id     UUID;
  rep_status TEXT;
  rep_title  TEXT;
  rep_start  DATE;
  rep_end    DATE;
  rep_total  NUMERIC(14,2);

  r1_id      UUID;
  r2_id      UUID;
  r1_num     TEXT;
  r2_num     TEXT;
BEGIN
  FOR i IN 1..55 LOOP
    rep_id     := gen_random_uuid();
    rep_status := statuses[1 + ((i - 1) % 10)];
    rep_start  := CURRENT_DATE - ((i * 3)::INT % 150);
    rep_end    := rep_start + 14;
    rep_title  := 'Expense Report ' || LPAD(i::TEXT, 3, '0') ||
                  ' — ' || TO_CHAR(rep_start, 'Mon YYYY');

    r1_num := 'VG-' || LPAD(((i * 2 - 1))::TEXT, 5, '0');
    r2_num := 'VG-' || LPAD(((i * 2))::TEXT, 5, '0');

    SELECT id INTO r1_id FROM receipts
      WHERE receipts.tenant_id = v_tenant_id
        AND receipt_number = r1_num LIMIT 1;
    SELECT id INTO r2_id FROM receipts
      WHERE receipts.tenant_id = v_tenant_id
        AND receipt_number = r2_num LIMIT 1;

    SELECT COALESCE(SUM(amount), 0) INTO rep_total
      FROM receipts WHERE id IN (r1_id, r2_id);

    INSERT INTO expense_reports (
      id, tenant_id, user_id,
      title, description,
      period_start, period_end,
      total_amount, status,
      approver_id,
      submitted_at, approved_at, rejected_at, paid_at,
      rejection_reason
    )
    VALUES (
      rep_id, v_tenant_id,
      v_employee,
      rep_title,
      'Seed report covering expenses from ' || rep_start || ' to ' || rep_end,
      rep_start, rep_end,
      rep_total, rep_status::report_status,
      CASE WHEN rep_status IN ('submitted','approved','rejected','paid','info_requested')
           THEN v_admin ELSE NULL END,
      CASE WHEN rep_status != 'draft'
           THEN rep_start + 15 ELSE NULL END,
      CASE WHEN rep_status IN ('approved','paid')
           THEN rep_start + 17 ELSE NULL END,
      CASE WHEN rep_status = 'rejected'
           THEN rep_start + 16 ELSE NULL END,
      CASE WHEN rep_status = 'paid'
           THEN rep_start + 20 ELSE NULL END,
      CASE WHEN rep_status = 'rejected'
           THEN 'Expense exceeds policy limit or missing documentation.'
           ELSE NULL END
    );

    IF r1_id IS NOT NULL THEN
      INSERT INTO expense_report_items (id, tenant_id, report_id, receipt_id, line_number)
      VALUES (gen_random_uuid(), v_tenant_id, rep_id, r1_id, 1)
      ON CONFLICT (report_id, receipt_id) DO NOTHING;
      UPDATE receipts SET submitted_in_report_id = rep_id WHERE id = r1_id;
    END IF;

    IF r2_id IS NOT NULL THEN
      INSERT INTO expense_report_items (id, tenant_id, report_id, receipt_id, line_number)
      VALUES (gen_random_uuid(), v_tenant_id, rep_id, r2_id, 2)
      ON CONFLICT (report_id, receipt_id) DO NOTHING;
      UPDATE receipts SET submitted_in_report_id = rep_id WHERE id = r2_id;
    END IF;

  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Approval workflows — one per non-draft report
--    Approver is always the admin (Rahman).
-- ---------------------------------------------------------------------------
INSERT INTO approval_workflows (
  id, tenant_id, report_id, current_level, total_levels,
  approver_id, status, comments, acted_at
)
SELECT
  gen_random_uuid(),
  er.tenant_id,
  er.id,
  1, 1,
  er.approver_id,
  er.status,
  CASE er.status
    WHEN 'approved'       THEN 'Looks good. Approved.'
    WHEN 'rejected'       THEN 'Expense exceeds policy limit.'
    WHEN 'info_requested' THEN 'Please attach original bills.'
    WHEN 'paid'           THEN 'Approved and reimbursed via UPI.'
    ELSE NULL
  END,
  CASE WHEN er.status != 'submitted'
       THEN er.submitted_at + INTERVAL '2 days'
       ELSE NULL END
FROM expense_reports er
WHERE er.status IN ('submitted','approved','rejected','paid','info_requested')
  AND er.approver_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 8. Reimbursements — one per paid report
-- ---------------------------------------------------------------------------
INSERT INTO reimbursements (
  id, tenant_id, report_id, method, reference_number,
  amount_paid, paid_by, paid_at
)
SELECT
  gen_random_uuid(),
  er.tenant_id,
  er.id,
  'upi',
  'UPI-' || UPPER(SUBSTRING(er.id::TEXT, 1, 8)),
  er.total_amount,
  er.approver_id,
  er.paid_at
FROM expense_reports er
WHERE er.status = 'paid'
  AND er.paid_at IS NOT NULL
ON CONFLICT (report_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9. Report comments — admin leaves comments on submitted/actioned reports
-- ---------------------------------------------------------------------------
INSERT INTO report_comments (
  id, tenant_id, report_id, author_user_id, message, is_resolved
)
SELECT
  gen_random_uuid(),
  er.tenant_id,
  er.id,
  er.approver_id,
  CASE (ROW_NUMBER() OVER (ORDER BY er.id)) % 4
    WHEN 0 THEN 'Please attach the original invoice for this expense.'
    WHEN 1 THEN 'Approved. Reimbursement will be processed by Friday.'
    WHEN 2 THEN 'Can you clarify the business purpose of this expense?'
    ELSE        'Looks good — processing now.'
  END,
  CASE WHEN er.status IN ('approved','paid') THEN TRUE ELSE FALSE END
FROM expense_reports er
WHERE er.status IN ('submitted','approved','paid','info_requested')
  AND er.approver_id IS NOT NULL
LIMIT 30;

-- ---------------------------------------------------------------------------
-- 10. Notifications — employee gets notified of every status change
-- ---------------------------------------------------------------------------
INSERT INTO notifications (
  id, tenant_id, user_id, channel, title, message,
  related_type, related_id, is_read, sent_at
)
SELECT
  gen_random_uuid(),
  er.tenant_id,
  er.user_id,                              -- notify the employee
  'in_app',
  CASE er.status
    WHEN 'approved'       THEN 'Report approved'
    WHEN 'rejected'       THEN 'Report rejected'
    WHEN 'paid'           THEN 'Reimbursement processed'
    WHEN 'info_requested' THEN 'More information requested'
    ELSE                       'Report status updated'
  END,
  CASE er.status
    WHEN 'approved'       THEN 'Your report "' || er.title || '" has been approved.'
    WHEN 'rejected'       THEN 'Your report "' || er.title || '" was rejected. Check comments.'
    WHEN 'paid'           THEN 'Reimbursement for "' || er.title || '" has been processed.'
    WHEN 'info_requested' THEN 'Your manager needs more info on "' || er.title || '".'
    ELSE                       'Status of "' || er.title || '" changed to ' || er.status || '.'
  END,
  'expense_report',
  er.id,
  CASE WHEN er.status IN ('approved','paid') THEN TRUE ELSE FALSE END,
  NOW() - ((RANDOM() * 10)::INT || ' days')::INTERVAL
FROM expense_reports er
WHERE er.status != 'draft';

-- ---------------------------------------------------------------------------
-- 11. GST export — one completed export for the last quarter
-- ---------------------------------------------------------------------------
INSERT INTO gst_exports (
  id, tenant_id, generated_by,
  period_start, period_end,
  total_amount, total_cgst, total_sgst, total_igst,
  generated_at
)
SELECT
  gen_random_uuid(),
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',  -- generated by admin
  DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')::DATE,
  (DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
    + INTERVAL '3 months - 1 day')::DATE,
  SUM(r.amount),
  SUM(r.cgst_amount),
  SUM(r.sgst_amount),
  SUM(r.igst_amount),
  NOW()
FROM receipts r
WHERE r.tenant_id = '10000000-0000-0000-0000-000000000001'
  AND r.status IN ('verified','needs_review')
  AND r.receipt_date >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')::DATE
  AND r.receipt_date <  (DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
                          + INTERVAL '3 months')::DATE
HAVING COUNT(*) > 0;

UPDATE gst_exports
SET file_path = 'exports/gst/vynsglobal-q' ||
  EXTRACT(QUARTER FROM period_start)::TEXT || '-' ||
  EXTRACT(YEAR  FROM period_start)::TEXT || '.csv'
WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
  AND file_path IS NULL;

-- ---------------------------------------------------------------------------
-- 12. Audit log — representative entries
-- ---------------------------------------------------------------------------
INSERT INTO audit_logs (
  id, tenant_id, user_id, action, resource_type, resource_id,
  request_id, metadata
)
VALUES
  (
    gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'tenant.created', 'tenant',
    '10000000-0000-0000-0000-000000000001',
    'seed-001', '{"source":"seed"}'::jsonb
  ),
  (
    gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'user.invited', 'user',
    '20000000-0000-0000-0000-000000000002',
    'seed-002', '{"invitedEmail":"ritchiedennis793@gmail.com"}'::jsonb
  ),
  (
    gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'policy.created', 'expense_policy',
    '30000000-0000-0000-0000-000000000001',
    'seed-003', '{"policyName":"Standard Expense Policy"}'::jsonb
  ),
  (
    gen_random_uuid(),
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'gst_export.generated', 'gst_export',
    NULL,
    'seed-004', '{"source":"seed"}'::jsonb
  );

-- ---------------------------------------------------------------------------
-- 13. Contact inquiry — sample entry in the admin panel inbox
-- ---------------------------------------------------------------------------
INSERT INTO contact_inquiries (
  id, sender_name, sender_email, reason, subject, message, status
)
VALUES (
  gen_random_uuid(),
  'Rahman Husain',
  'rahmanhusain899@gmail.com',
  'feedback',
  'Great product — a few suggestions',
  'The approval workflow is very smooth. Would love to see bulk export and custom categories in a future update.',
  'new'
)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Commit
-- ---------------------------------------------------------------------------
COMMIT;

-- ---------------------------------------------------------------------------
-- Verification — prints row counts for every seeded table
-- ---------------------------------------------------------------------------
SELECT 'super_admins'      AS "table", COUNT(*) AS rows FROM super_admins
UNION ALL
SELECT 'tenants',            COUNT(*) FROM tenants
UNION ALL
SELECT 'users (workspace)',  COUNT(*) FROM users
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'expense_policies',   COUNT(*) FROM expense_policies
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'receipts',           COUNT(*) FROM receipts
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'expense_reports',    COUNT(*) FROM expense_reports
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'report_items',       COUNT(*) FROM expense_report_items
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'approval_workflows', COUNT(*) FROM approval_workflows
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'reimbursements',     COUNT(*) FROM reimbursements
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'notifications',      COUNT(*) FROM notifications
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'gst_exports',        COUNT(*) FROM gst_exports
  WHERE tenant_id = '10000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'contact_inquiries',  COUNT(*) FROM contact_inquiries
ORDER BY 1;
