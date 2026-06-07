import { query } from "@/lib/db/client";
import type { PoolClient } from "pg";
import { getStoredReceiptFileUrl } from "@/lib/storage/receipt-storage";

type ReceiptStatus =
  | "processing"
  | "draft"
  | "verified"
  | "needs_review"
  | "archived";

type UserRole = "employee" | "manager" | "admin";

let receiptCommentsTableReady: Promise<void> | null = null;

async function ensureReceiptCommentsTable(): Promise<void> {
  if (!receiptCommentsTableReady) {
    receiptCommentsTableReady = query(
      `CREATE TABLE IF NOT EXISTS receipt_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
        author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        message TEXT NOT NULL,
        is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_receipt_comments_tenant_receipt
      ON receipt_comments(tenant_id, receipt_id, created_at DESC);`,
    ).then(() => undefined);
  }

  await receiptCommentsTableReady;
}

export type ReceiptCommentView = {
  id: string;
  author: string;
  authorRole: UserRole | "unknown";
  message: string;
  createdAt: string;
};

export type ReceiptListItem = {
  id: string;
  receiptId: string;
  vendor: string;
  amount: number;
  currency: string;
  category: string;
  status: ReceiptStatus;
  receiptDate: string;
  uploadedAt: string;
  uploadedBy: string;
  uploadedByUserId: string;
  uploadedByRole: UserRole;
  fileUrl: string | null;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  description: string;
  gstRate: number | null;
  cgstRate: number | null;
  igstRate: number | null;
  sgstRate: number | null;
  cgstAmount: number | null;
  igstAmount: number | null;
  sgstAmount: number | null;
  taxAmount: number | null;
  vendorGstin: string | null;
  confidenceScore: number | null;
  isDuplicate: boolean;
  duplicateOf: string | null;
  submittedInReportId: string | null;
  comments: ReceiptCommentView[];
};

export type ReceiptQueryOptions = {
  limit?: number;
  offset?: number;
  search?: string;
  status?: ReceiptStatus | "all";
  category?: string | "all";
  year?: string | "all";
  month?: string | "all";
  dateFrom?: string;
  dateTo?: string;
};

export type CreatedReceiptComment = {
  id: string;
  message: string;
  createdAt: string;
};

export type ReviewedReceipt = {
  id: string;
  status: ReceiptStatus;
  is_duplicate: boolean;
  duplicate_of: string | null;
  updated_at: string;
};

export type CreateReceiptInput = {
  tenantId: string;
  userId: string;
  vendorName: string;
  amount: number;
  currency: string;
  receiptDate: string;
  category: string;
  gstRate: number | null;
  cgstRate: number | null;
  igstRate: number | null;
  sgstRate: number | null;
  cgstAmount: number | null;
  igstAmount: number | null;
  sgstAmount: number | null;
  taxAmount: number | null;
  vendorGstin: string | null;
  note: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  parsedData: Record<string, unknown>;
  confidenceScore: number;
  status: ReceiptStatus;
  isDuplicate?: boolean;
  duplicateOf?: string | null;
};

export type CreatedReceipt = {
  id: string;
  receipt_number: string | null;
  vendor_name: string | null;
  amount: string;
  currency: string;
  receipt_date: string;
  category: string | null;
  status: ReceiptStatus;
  description: string | null;
  confidence_score: string | null;
  parsed_data: Record<string, unknown> | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
  created_at: string;
};

export type DuplicateReceiptCandidate = {
  id: string;
  vendor_name: string | null;
  amount: string;
  currency: string;
  receipt_date: string;
  category: string | null;
  mime_type: string | null;
  file_path: string | null;
  file_name: string | null;
  description: string | null;
  created_at: string;
};

function toMonthStartDate(month: string | "all" | undefined): string | null {
  if (!month || month === "all") {
    return null;
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  return `${month}-01`;
}

type ReceiptFilterOptions = Pick<
  ReceiptQueryOptions,
  "search" | "status" | "category" | "year" | "month" | "dateFrom" | "dateTo"
>;

function buildReceiptFilterSql(
  tenantId: string,
  options: ReceiptFilterOptions,
): { whereClause: string; params: Array<string | number | null> } {
  const params: Array<string | number | null> = [tenantId];
  const conditions: string[] = ["r.tenant_id = $1"];

  const addParam = (value: string | number | null) => {
    params.push(value);
    return `$${params.length}`;
  };

  const search = options.search?.trim().toLowerCase();
  if (search) {
    const searchParam = addParam(`%${search}%`);
    conditions.push(
      `(
        LOWER(COALESCE(r.receipt_number::text, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(r.vendor_name, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(r.description, '')) LIKE ${searchParam}
        OR LOWER(COALESCE(r.file_name, '')) LIKE ${searchParam}
        OR LOWER(
          COALESCE(
            CONCAT('RCPT-', UPPER(SUBSTRING(REPLACE(r.id::text, '-', '') FROM 1 FOR 8))),
            ''
          )
        ) LIKE ${searchParam}
      )`,
    );
  }

  if (options.status && options.status !== "all") {
    const statusParam = addParam(options.status);
    conditions.push(`r.status = ${statusParam}`);
  }

  if (options.category && options.category !== "all") {
    const categoryParam = addParam(options.category.toLowerCase());
    conditions.push(`LOWER(COALESCE(r.category, '')) = ${categoryParam}`);
  }

  if (options.year && options.year !== "all") {
    const parsedYear = Number(options.year);
    if (Number.isInteger(parsedYear)) {
      const yearParam = addParam(parsedYear);
      conditions.push(`EXTRACT(YEAR FROM r.receipt_date)::int = ${yearParam}`);
    }
  }

  if (options.month && options.month !== "all") {
    const parsedMonth = toMonthStartDate(options.month);
    if (parsedMonth) {
      const monthParam = addParam(parsedMonth);
      conditions.push(
        `DATE_TRUNC('month', r.receipt_date) = DATE_TRUNC('month', ${monthParam}::date)`,
      );
    }
  }

  if (options.dateFrom && options.dateTo) {
    const fromParam = addParam(options.dateFrom);
    const toParam = addParam(options.dateTo);
    conditions.push(
      `r.receipt_date >= ${fromParam}::date AND r.receipt_date <= ${toParam}::date`,
    );
  }

  return {
    whereClause: conditions.join(" AND "),
    params,
  };
}

export async function findDuplicateReceiptCandidate(input: {
  tenantId: string;
  amount: number;
  currency: string;
  receiptDate: string;
  vendorGstin?: string | null;
  receiptTime?: string | null;
  ocrFingerprint?: string | null;
}): Promise<DuplicateReceiptCandidate | null> {
  // Match DB precision: store amounts as numeric(14,2) in Postgres.
  // Round the incoming amount to 2 decimal places to avoid float-equality misses.
  const roundedAmount = Number(Number(input.amount).toFixed(2));

  const params: (string | number)[] = [
    input.tenantId,
    roundedAmount,
    input.receiptDate,
  ];

  let conditions: string[] = [];

  // Primary key: GSTIN + receipt_date + amount (if GSTIN is available)
  if (input.vendorGstin) {
    conditions = [
      "tenant_id = $1",
      "amount = $2",
      "receipt_date = $3::date",
      `UPPER(COALESCE(vendor_gstin, '')) = UPPER($${params.length + 1})`,
    ];
    params.push(input.vendorGstin);
  } else {
    // Fallback: receipt_date + amount (without GSTIN)
    conditions = ["tenant_id = $1", "amount = $2", "receipt_date = $3::date"];
  }

  // Optional: add receipt_time if available for more precise matching
  if (input.receiptTime) {
    conditions.push(
      `COALESCE(parsed_data->>'receipt_time', '') = $${params.length + 1}`,
    );
    params.push(input.receiptTime);
  }

  const result = await query<DuplicateReceiptCandidate>(
    `SELECT
      id,
      vendor_name,
      amount::text,
      currency,
      receipt_date::text,
      category,
      mime_type,
      file_path,
      file_name,
      description,
      created_at::text
    FROM receipts
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT 1`,
    params,
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  // Fallback tolerant search: amount within +/- 1.00 and date within +/- 1 day.
  // Prefer records with matching OCR fingerprint when available.
  const tolerance = 1.0; // INR tolerance
  const fallbackParams: (string | number)[] = [
    input.tenantId,
    roundedAmount - tolerance,
    roundedAmount + tolerance,
    input.receiptDate,
    input.receiptDate,
  ];

  let fallbackSql = `SELECT
      id,
      vendor_name,
      amount::text,
      currency,
      receipt_date::text,
      category,
      mime_type,
      file_path,
      file_name,
      description,
      created_at::text
    FROM receipts
    WHERE tenant_id = $1
      AND amount BETWEEN $2 AND $3
      AND receipt_date BETWEEN ($4::date - INTERVAL '1 day') AND ($5::date + INTERVAL '1 day')`;

  if (input.ocrFingerprint) {
    // Put exact fingerprint matches first in ordering
    fallbackSql += ` ORDER BY (CASE WHEN COALESCE(parsed_data->>'ocr_fingerprint', '') = $6 THEN 0 ELSE 1 END), created_at DESC LIMIT 1`;
    fallbackParams.push(input.ocrFingerprint);
  } else {
    fallbackSql += ` ORDER BY created_at DESC LIMIT 1`;
  }

  const fallback = await query<DuplicateReceiptCandidate>(
    fallbackSql,
    fallbackParams,
  );
  return fallback.rows[0] ?? null;
}

type ReceiptQueryRow = {
  id: string;
  receipt_id: string;
  vendor_name: string | null;
  amount: string | number;
  currency: string;
  category: string | null;
  status: ReceiptStatus;
  receipt_date: string;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_user_id: string;
  uploaded_by_role: UserRole;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: string | number | null;
  description: string | null;
  gst_rate: string | number | null;
  cgst_rate: string | number | null;
  igst_rate: string | number | null;
  sgst_rate: string | number | null;
  cgst_amount: string | number | null;
  igst_amount: string | number | null;
  sgst_amount: string | number | null;
  tax_amount: string | number | null;
  vendor_gstin: string | null;
  confidence_score: string | number | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
  submitted_in_report_id: string | null;
  comments: unknown;
};

function toNumber(value: string | number | null): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseComments(value: unknown): ReceiptCommentView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;

      return {
        id: String(record.id ?? ""),
        author: String(record.author ?? "Unknown"),
        authorRole:
          record.authorRole === "admin" ||
          record.authorRole === "manager" ||
          record.authorRole === "employee"
            ? record.authorRole
            : "unknown",
        message: String(record.message ?? ""),
        createdAt: String(record.createdAt ?? ""),
      };
    })
    .filter((item): item is ReceiptCommentView =>
      Boolean(item && item.id && item.message),
    );
}

export async function getReceiptsForTenant(
  tenantId: string,
  options: ReceiptQueryOptions = {},
): Promise<ReceiptListItem[]> {
  await ensureReceiptCommentsTable();
  const rawLimit = options.limit ?? 200;
  const rawOffset = options.offset ?? 0;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), 200)
    : 200;
  const offset = Number.isFinite(rawOffset)
    ? Math.max(Math.floor(rawOffset), 0)
    : 0;

  const filter = buildReceiptFilterSql(tenantId, options);
  const limitPlaceholder = `$${filter.params.length + 1}`;
  const offsetPlaceholder = `$${filter.params.length + 2}`;

  const result = await query<ReceiptQueryRow>(
    `WITH all_comments AS (
      SELECT id, tenant_id, receipt_id, author_user_id, message, created_at
      FROM report_comments
      WHERE receipt_id IS NOT NULL
      UNION ALL
      SELECT id, tenant_id, receipt_id, author_user_id, message, created_at
      FROM receipt_comments
    )
    SELECT
      r.id,
      COALESCE(r.receipt_number, CONCAT('RCPT-', UPPER(SUBSTRING(REPLACE(r.id::text, '-', '') FROM 1 FOR 8)))) AS receipt_id,
      r.vendor_name,
      r.amount,
      r.currency,
      r.category,
      r.status,
      r.receipt_date::text,
      r.created_at::text AS uploaded_at,
      COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS uploaded_by,
      u.id::text AS uploaded_by_user_id,
      u.role AS uploaded_by_role,
      r.file_path,
      r.file_name,
      r.mime_type,
      r.file_size_bytes,
      r.description,
      r.gst_rate,
      r.cgst_rate,
      r.igst_rate,
      r.sgst_rate,
      r.cgst_amount,
      r.igst_amount,
      r.sgst_amount,
      r.tax_amount,
      r.vendor_gstin,
      r.confidence_score,
      r.is_duplicate,
      r.duplicate_of,
      r.submitted_in_report_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id', c.id,
            'author', COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), cu.email),
            'authorRole', COALESCE(cu.role::text, 'unknown'),
            'message', c.message,
            'createdAt', c.created_at::text
          )
          ORDER BY c.created_at DESC
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'::json
      ) AS comments
    FROM receipts r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN all_comments c ON c.receipt_id = r.id AND c.tenant_id = r.tenant_id
    LEFT JOIN users cu ON cu.id = c.author_user_id
    WHERE ${filter.whereClause}
    GROUP BY r.id, u.id, u.first_name, u.last_name, u.email, u.role
    ORDER BY r.created_at DESC
    LIMIT ${limitPlaceholder}
    OFFSET ${offsetPlaceholder}`,
    [...filter.params, limit, offset],
  );

  return Promise.all(
    result.rows.map(async (row) => ({
      id: row.id,
      receiptId: row.receipt_id,
      vendor: row.vendor_name ?? "Unknown vendor",
      amount: Number(row.amount),
      currency: row.currency,
      category: row.category ?? "Uncategorized",
      status: row.status,
      receiptDate: row.receipt_date,
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by,
      uploadedByUserId: row.uploaded_by_user_id,
      uploadedByRole: row.uploaded_by_role,
      fileUrl: await getStoredReceiptFileUrl(row.file_path),
      fileName: row.file_name ?? "receipt-file",
      mimeType: row.mime_type ?? "application/octet-stream",
      fileSizeBytes: toNumber(row.file_size_bytes),
      description: row.description ?? "No description provided.",
      gstRate: toNumber(row.gst_rate),
      cgstRate: toNumber(row.cgst_rate),
      igstRate: toNumber(row.igst_rate),
      sgstRate: toNumber(row.sgst_rate),
      cgstAmount: toNumber(row.cgst_amount),
      igstAmount: toNumber(row.igst_amount),
      sgstAmount: toNumber(row.sgst_amount),
      taxAmount: toNumber(row.tax_amount),
      vendorGstin: row.vendor_gstin,
      confidenceScore: toNumber(row.confidence_score),
      isDuplicate: row.is_duplicate,
      duplicateOf: row.duplicate_of,
      submittedInReportId: row.submitted_in_report_id,
      comments: parseComments(row.comments),
    })),
  );
}

export async function getReceiptById(
  tenantId: string,
  receiptId: string,
): Promise<ReceiptListItem | null> {
  await ensureReceiptCommentsTable();

  const result = await query<ReceiptQueryRow>(
    `WITH all_comments AS (
      SELECT id, tenant_id, receipt_id, author_user_id, message, created_at
      FROM report_comments
      WHERE receipt_id IS NOT NULL
      UNION ALL
      SELECT id, tenant_id, receipt_id, author_user_id, message, created_at
      FROM receipt_comments
    )
    SELECT
      r.id,
      COALESCE(r.receipt_number, CONCAT('RCPT-', UPPER(SUBSTRING(REPLACE(r.id::text, '-', '') FROM 1 FOR 8)))) AS receipt_id,
      r.vendor_name,
      r.amount,
      r.currency,
      r.category,
      r.status,
      r.receipt_date::text,
      r.created_at::text AS uploaded_at,
      COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS uploaded_by,
      u.id::text AS uploaded_by_user_id,
      u.role AS uploaded_by_role,
      r.file_path,
      r.file_name,
      r.mime_type,
      r.file_size_bytes,
      r.description,
      r.gst_rate,
      r.cgst_rate,
      r.igst_rate,
      r.sgst_rate,
      r.cgst_amount,
      r.igst_amount,
      r.sgst_amount,
      r.tax_amount,
      r.vendor_gstin,
      r.confidence_score,
      r.is_duplicate,
      r.duplicate_of,
      r.submitted_in_report_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id', c.id,
            'author', COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), cu.email),
            'authorRole', COALESCE(cu.role::text, 'unknown'),
            'message', c.message,
            'createdAt', c.created_at::text
          )
          ORDER BY c.created_at DESC
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'::json
      ) AS comments
    FROM receipts r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN all_comments c ON c.receipt_id = r.id AND c.tenant_id = r.tenant_id
    LEFT JOIN users cu ON cu.id = c.author_user_id
    WHERE r.tenant_id = $1 AND (
      r.id::text = $2
      OR r.receipt_number = $2
      OR CONCAT('RCPT-', UPPER(SUBSTRING(REPLACE(r.id::text, '-', '') FROM 1 FOR 8))) = $2
    )
    GROUP BY r.id, u.id, u.first_name, u.last_name, u.email, u.role
    LIMIT 1`,
    [tenantId, receiptId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    receiptId: row.receipt_id,
    vendor: row.vendor_name ?? "Unknown vendor",
    amount: Number(row.amount),
    currency: row.currency,
    category: row.category ?? "Uncategorized",
    status: row.status,
    receiptDate: row.receipt_date,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
    uploadedByUserId: row.uploaded_by_user_id,
    uploadedByRole: row.uploaded_by_role,
    fileUrl: await getStoredReceiptFileUrl(row.file_path),
    fileName: row.file_name ?? "receipt-file",
    mimeType: row.mime_type ?? "application/octet-stream",
    fileSizeBytes: toNumber(row.file_size_bytes),
    description: row.description ?? "No description provided.",
    gstRate: toNumber(row.gst_rate),
    cgstRate: toNumber(row.cgst_rate),
    igstRate: toNumber(row.igst_rate),
    sgstRate: toNumber(row.sgst_rate),
    cgstAmount: toNumber(row.cgst_amount),
    igstAmount: toNumber(row.igst_amount),
    sgstAmount: toNumber(row.sgst_amount),
    taxAmount: toNumber(row.tax_amount),
    vendorGstin: row.vendor_gstin,
    confidenceScore: toNumber(row.confidence_score),
    isDuplicate: row.is_duplicate,
    duplicateOf: row.duplicate_of,
    submittedInReportId: row.submitted_in_report_id,
    comments: parseComments(row.comments),
  };
}

type ReceiptCountRow = {
  total: string | number;
};

export async function getReceiptCountForTenant(
  tenantId: string,
  options: Pick<
    ReceiptQueryOptions,
    "search" | "status" | "category" | "year" | "month" | "dateFrom" | "dateTo"
  > = {},
): Promise<number> {
  const filter = buildReceiptFilterSql(tenantId, options);

  const result = await query<ReceiptCountRow>(
    `SELECT COUNT(*)::text AS total
     FROM receipts r
     WHERE ${filter.whereClause}`,
    filter.params,
  );

  return Number(result.rows[0]?.total ?? 0);
}

type ReceiptMonthRow = {
  month_value: string;
};

export async function getReceiptMonthsForTenant(
  tenantId: string,
): Promise<string[]> {
  const result = await query<ReceiptMonthRow>(
    `SELECT TO_CHAR(DATE_TRUNC('month', r.receipt_date), 'YYYY-MM') AS month_value
     FROM receipts r
     WHERE r.tenant_id = $1
     GROUP BY 1
     ORDER BY 1 DESC`,
    [tenantId],
  );

  return result.rows.map((row) => row.month_value).filter(Boolean);
}

type ReceiptCommentInsertRow = {
  id: string;
  message: string;
  created_at: string;
};

export async function createReceiptComment(input: {
  tenantId: string;
  receiptId: string;
  userId: string;
  message: string;
}): Promise<CreatedReceiptComment | null> {
  await ensureReceiptCommentsTable();

  const result = await query<ReceiptCommentInsertRow>(
    `INSERT INTO receipt_comments (
      tenant_id,
      receipt_id,
      author_user_id,
      message,
      created_at,
      updated_at
    )
    SELECT
      $1,
      r.id,
      $3,
      $4,
      NOW(),
      NOW()
    FROM receipts r
    WHERE r.tenant_id = $1
      AND r.id = $2
    RETURNING id, message, created_at::text`,
    [input.tenantId, input.receiptId, input.userId, input.message],
  );

  const created = result.rows[0];

  if (!created) {
    return null;
  }

  return {
    id: created.id,
    message: created.message,
    createdAt: created.created_at,
  };
}

export async function createUploadedReceipt(
  input: CreateReceiptInput,
  client?: PoolClient,
): Promise<CreatedReceipt> {
  const executor = client ? client.query.bind(client) : query;

  const result = await executor<CreatedReceipt>(
    `INSERT INTO receipts (
      tenant_id,
      user_id,
      vendor_name,
      amount,
      currency,
      receipt_date,
      category,
      gst_rate,
      cgst_rate,
      igst_rate,
      sgst_rate,
      cgst_amount,
      igst_amount,
      sgst_amount,
      tax_amount,
      vendor_gstin,
      description,
      file_path,
      file_name,
      mime_type,
      file_size_bytes,
      parsed_data,
      confidence_score,
      status,
      is_duplicate,
      duplicate_of,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23, $24, $25, $26, NOW(), NOW()
    )
    RETURNING
      id,
      receipt_number,
      vendor_name,
      amount::text,
      currency,
      receipt_date::text,
      category,
      status,
      description,
      confidence_score::text,
      parsed_data,
      is_duplicate,
      duplicate_of,
      created_at::text`,
    [
      input.tenantId,
      input.userId,
      input.vendorName,
      input.amount,
      input.currency,
      input.receiptDate,
      input.category,
      input.gstRate,
      input.cgstRate,
      input.igstRate,
      input.sgstRate,
      input.cgstAmount,
      input.igstAmount,
      input.sgstAmount,
      input.taxAmount,
      input.vendorGstin,
      input.note,
      input.filePath,
      input.fileName,
      input.mimeType,
      input.fileSizeBytes,
      JSON.stringify(input.parsedData),
      input.confidenceScore,
      input.status,
      Boolean(input.isDuplicate),
      input.duplicateOf ?? null,
    ],
  );

  return result.rows[0];
}

export async function approveReceiptByManager(input: {
  tenantId: string;
  receiptId: string;
}): Promise<ReviewedReceipt | null> {
  const result = await query<ReviewedReceipt>(
    `UPDATE receipts
     SET status = 'verified',
         is_duplicate = FALSE,
         duplicate_of = NULL,
         updated_at = NOW()
     WHERE tenant_id = $1
       AND id = $2
       AND status IN ('needs_review', 'draft')
     RETURNING id, status, is_duplicate, duplicate_of, updated_at::text`,
    [input.tenantId, input.receiptId],
  );

  return result.rows[0] ?? null;
}

export async function rejectReceiptByManager(input: {
  tenantId: string;
  receiptId: string;
}): Promise<ReviewedReceipt | null> {
  const result = await query<ReviewedReceipt>(
    `UPDATE receipts
     SET status = 'archived',
         updated_at = NOW()
     WHERE tenant_id = $1
       AND id = $2
       AND status = 'needs_review'
     RETURNING id, status, is_duplicate, duplicate_of, updated_at::text`,
    [input.tenantId, input.receiptId],
  );

  return result.rows[0] ?? null;
}
