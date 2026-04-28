import { NextResponse } from "next/server";

type ValidationResult = {
  ok: boolean;
  reportsFound: number;
  receiptsFound: number;
  errors: string[];
};

function parseCsv(csv: string): Array<Record<string, string>> {
  const rows: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "\n" && !inQuotes) {
      rows.push(cur.replace(/\r$/, ""));
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length) rows.push(cur.replace(/\r$/, ""));

  if (rows.length === 0) return [];

  const header = rows[0]
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const records: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    if (!rows[r].trim()) continue;
    const cols = rows[r]
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((c) => c.trim().replace(/^"|"$/g, ""));
    const rec: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      rec[header[c]] = cols[c] ?? "";
    }
    records.push(rec);
  }

  return records;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const csv = String(body.csv || "");
    if (!csv) {
      return NextResponse.json(
        { ok: false, error: "Missing CSV body" },
        { status: 400 },
      );
    }

    const records = parseCsv(csv);

    const errors: string[] = [];

    const requiredReceiptCols = [
      "receipt_id",
      "receipt_vendor",
      "receipt_amount",
      "receipt_date",
    ];

    if (records.length === 0) {
      errors.push("CSV contains no records");
      const result: ValidationResult = {
        ok: false,
        reportsFound: 0,
        receiptsFound: 0,
        errors,
      };
      return NextResponse.json(result, { status: 400 });
    }

    const headers = Object.keys(records[0] || {});
    for (const col of requiredReceiptCols) {
      if (!headers.includes(col)) {
        errors.push(`Missing required column: ${col}`);
      }
    }

    // Group by report title (optional) or synthetic grouping
    const reportTitles = new Set<string>();
    let receiptsCount = 0;
    let totalAmountComputed = 0;
    let declaredTotal: number | null = null;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      receiptsCount++;
      const line = i + 2;
      const title = (r["report_title"] || r["Report Title"] || "").trim();
      if (title) reportTitles.add(title);

      const amtRaw = (r["receipt_amount"] || r["Amount"] || "").trim();
      const parsed = Number(amtRaw.replace(/[^0-9.-]+/g, ""));
      if (!Number.isFinite(parsed)) {
        errors.push(`Invalid amount on line ${line}: '${amtRaw}'`);
      } else {
        totalAmountComputed += parsed;
      }

      const dateRaw = (r["receipt_date"] || r["Date"] || "").trim();
      if (dateRaw) {
        const d = new Date(dateRaw);
        if (Number.isNaN(d.getTime())) {
          errors.push(`Invalid date on line ${line}: '${dateRaw}'`);
        }
      }

      const declaredRaw = (
        r["report_total_amount"] ||
        r["Report Total"] ||
        ""
      ).trim();
      if (declaredRaw && declaredTotal === null) {
        const pd = Number(declaredRaw.replace(/[^0-9.-]+/g, ""));
        if (Number.isFinite(pd)) declaredTotal = pd;
      }
    }

    if (declaredTotal !== null) {
      const diff = Math.abs(declaredTotal - totalAmountComputed);
      if (diff > 0.01) {
        errors.push(
          `Declared report total (${declaredTotal}) does not match sum of receipts (${totalAmountComputed.toFixed(2)})`,
        );
      }
    }

    const result: ValidationResult = {
      ok: errors.length === 0,
      reportsFound: reportTitles.size || 1,
      receiptsFound: receiptsCount,
      errors,
    };

    return NextResponse.json(result, { status: errors.length ? 400 : 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}
