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
