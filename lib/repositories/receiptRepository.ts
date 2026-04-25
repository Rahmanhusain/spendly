import { query } from "@/lib/db/client";

type ReceiptStatus =
  | "processing"
  | "draft"
  | "verified"
  | "needs_review"
  | "archived";

export type ReceiptCommentView = {
  id: string;
  author: string;
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
  fileName: string;
  mimeType: string;
  description: string;
  comments: ReceiptCommentView[];
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
  gstType: string | null;
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

export async function findDuplicateReceiptCandidate(input: {
  tenantId: string;
  vendorName: string;
  amount: number;
  currency: string;
  receiptDate: string;
}): Promise<DuplicateReceiptCandidate | null> {
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
    WHERE tenant_id = $1
      AND LOWER(COALESCE(vendor_name, '')) = LOWER($2)
      AND amount = $3
      AND currency = $4
      AND receipt_date = $5::date
    ORDER BY created_at DESC
    LIMIT 1`,
    [
      input.tenantId,
      input.vendorName,
      input.amount,
      input.currency,
      input.receiptDate,
    ],
  );

  return result.rows[0] ?? null;
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
  file_name: string | null;
  mime_type: string | null;
  description: string | null;
  comments: unknown;
};

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
): Promise<ReceiptListItem[]> {
  const result = await query<ReceiptQueryRow>(
    `SELECT
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
      r.file_name,
      r.mime_type,
      r.description,
      COALESCE(
        json_agg(
          json_build_object(
            'id', c.id,
            'author', COALESCE(NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''), cu.email),
            'message', c.message,
            'createdAt', c.created_at::text
          )
          ORDER BY c.created_at DESC
        ) FILTER (WHERE c.id IS NOT NULL),
        '[]'::json
      ) AS comments
    FROM receipts r
    JOIN users u ON u.id = r.user_id
    LEFT JOIN report_comments c ON c.receipt_id = r.id AND c.tenant_id = r.tenant_id
    LEFT JOIN users cu ON cu.id = c.author_user_id
    WHERE r.tenant_id = $1
    GROUP BY r.id, u.first_name, u.last_name, u.email
    ORDER BY r.created_at DESC`,
    [tenantId],
  );

  return result.rows.map((row) => ({
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
    fileName: row.file_name ?? "receipt-file",
    mimeType: row.mime_type ?? "application/octet-stream",
    description: row.description ?? "No description provided.",
    comments: parseComments(row.comments),
  }));
}

export async function createUploadedReceipt(
  input: CreateReceiptInput,
): Promise<CreatedReceipt> {
  const result = await query<CreatedReceipt>(
    `INSERT INTO receipts (
      tenant_id,
      user_id,
      vendor_name,
      amount,
      currency,
      receipt_date,
      category,
      gst_rate,
      gst_type,
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
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20, $21, NOW(), NOW()
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
      input.gstType,
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
       AND status = 'needs_review'
     RETURNING id, status, is_duplicate, duplicate_of, updated_at::text`,
    [input.tenantId, input.receiptId],
  );

  return result.rows[0] ?? null;
}
