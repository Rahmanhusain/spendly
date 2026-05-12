import { query } from "@/lib/db/client";

export type GstVendorRow = {
  category: string | null;
  vendor_name: string | null;
  vendor_gstin: string | null;
  total_amount: string;
  total_cgst: string;
  total_sgst: string;
  total_igst: string;
  total_tax: string;
};

export type GstAggregateResult = {
  totals: {
    totalAmount: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    receiptCount: number;
  };
  byVendor: GstVendorRow[];
};

export type GstExportHistoryRow = {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: string;
  total_cgst: string;
  total_sgst: string;
  total_igst: string;
  file_path: string | null;
  generated_at: string;
  generated_by_name: string;
  generated_by_role: string;
};

export async function aggregateGstForPeriod(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
): Promise<GstAggregateResult> {
  const vendorRows = await query<GstVendorRow>(
    `SELECT
      COALESCE(category, 'Uncategorized') AS category,
      COALESCE(vendor_name, 'Unknown') AS vendor_name,
      vendor_gstin,
      SUM(COALESCE(amount, 0))::text AS total_amount,
      SUM(COALESCE(cgst_amount, 0))::text AS total_cgst,
      SUM(COALESCE(sgst_amount, 0))::text AS total_sgst,
      SUM(COALESCE(igst_amount, 0))::text AS total_igst,
      SUM(COALESCE(tax_amount, 0))::text AS total_tax
    FROM receipts
    WHERE tenant_id = $1
      AND receipt_date >= $2::date
      AND receipt_date <= $3::date
    GROUP BY 1,2,3
    ORDER BY 1,2`,
    [tenantId, periodStart, periodEnd],
  );

  const totalsRow = await query(
    `SELECT
      SUM(COALESCE(amount,0))::text AS total_amount,
      SUM(COALESCE(cgst_amount,0))::text AS total_cgst,
      SUM(COALESCE(sgst_amount,0))::text AS total_sgst,
      SUM(COALESCE(igst_amount,0))::text AS total_igst,
      COUNT(*)::text AS receipt_count
    FROM receipts
    WHERE tenant_id = $1
      AND receipt_date >= $2::date
      AND receipt_date <= $3::date`,
    [tenantId, periodStart, periodEnd],
  );

  const t = totalsRow.rows[0] ?? {
    total_amount: "0",
    total_cgst: "0",
    total_sgst: "0",
    total_igst: "0",
  };

  return {
    totals: {
      totalAmount: Number(t.total_amount ?? 0),
      totalCgst: Number(t.total_cgst ?? 0),
      totalSgst: Number(t.total_sgst ?? 0),
      totalIgst: Number(t.total_igst ?? 0),
      receiptCount: Number(t.receipt_count ?? 0),
    },
    byVendor: vendorRows.rows,
  };
}

export async function getGstExportHistoryForTenant(
  tenantId: string,
  limit = 5,
): Promise<GstExportHistoryRow[]> {
  const cappedLimit = Math.min(Math.max(Math.floor(limit), 1), 20);

  const result = await query<GstExportHistoryRow>(
    `SELECT
      g.id,
      g.period_start::text,
      g.period_end::text,
      g.total_amount::text,
      g.total_cgst::text,
      g.total_sgst::text,
      g.total_igst::text,
      g.file_path,
      g.generated_at::text,
      COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), u.email) AS generated_by_name,
      COALESCE(u.role::text, 'unknown') AS generated_by_role
    FROM gst_exports g
    JOIN users u ON u.id = g.generated_by
    WHERE g.tenant_id = $1
    ORDER BY g.generated_at DESC
    LIMIT $2`,
    [tenantId, cappedLimit],
  );

  return result.rows;
}

export async function createGstExportRecord(input: {
  tenantId: string;
  generatedBy: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  filePath?: string | null;
}) {
  const result = await query(
    `INSERT INTO gst_exports (
      tenant_id, generated_by, period_start, period_end,
      total_amount, total_cgst, total_sgst, total_igst, file_path
    ) VALUES ($1,$2,$3::date,$4::date,$5,$6,$7,$8,$9)
    RETURNING id, generated_at::text, created_at::text`,
    [
      input.tenantId,
      input.generatedBy,
      input.periodStart,
      input.periodEnd,
      input.totalAmount,
      input.totalCgst,
      input.totalSgst,
      input.totalIgst,
      input.filePath ?? null,
    ],
  );

  return result.rows[0];
}

export const gstRepository = {
  aggregateGstForPeriod,
  createGstExportRecord,
  getGstExportHistoryForTenant,
};
