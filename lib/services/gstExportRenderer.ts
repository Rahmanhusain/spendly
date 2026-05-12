import { GstAggregateResult } from "@/lib/repositories/gstRepository";

function fmtINR(value: number | string) {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function renderGstHtml(opts: {
  companyName?: string;
  companyGstin?: string;
  periodStart: string;
  periodEnd: string;
  data: GstAggregateResult;
  generatedAt?: string;
}) {
  const {
    companyName = "Company",
    companyGstin = "",
    periodStart,
    periodEnd,
    data,
    generatedAt,
  } = opts;

  const rowsByCategory: Record<
    string,
    { total: number; cgst: number; sgst: number; igst: number }[]
  > = {};

  // Build detail rows
  const detailRows = data.byVendor.map((r) => {
    return {
      category: r.category ?? "Uncategorized",
      vendor: r.vendor_name ?? "Unknown",
      vendorGstin: r.vendor_gstin ?? "",
      amount: Number(r.total_amount || 0),
      cgst: Number(r.total_cgst || 0),
      sgst: Number(r.total_sgst || 0),
      igst: Number(r.total_igst || 0),
      tax: Number(r.total_tax || 0),
    };
  });

  // Build category summary
  const categoryMap: Record<
    string,
    { total: number; cgst: number; sgst: number; igst: number }
  > = {};
  detailRows.forEach((d) => {
    if (!categoryMap[d.category])
      categoryMap[d.category] = { total: 0, cgst: 0, sgst: 0, igst: 0 };
    categoryMap[d.category].total += d.amount;
    categoryMap[d.category].cgst += d.cgst;
    categoryMap[d.category].sgst += d.sgst;
    categoryMap[d.category].igst += d.igst;
  });

  const categoryRows = Object.keys(categoryMap).map((cat) => ({
    category: cat,
    ...categoryMap[cat],
  }));

  const now = generatedAt ?? new Date().toISOString();

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>GST Compliance Report</title>
    <style>
      body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin: 24px; color: #111827 }
      header { display:flex; justify-content:space-between; align-items:baseline }
      h1 { margin:0; font-size:20px }
      table { width:100%; border-collapse:collapse; margin-top:12px }
      th, td { border:1px solid #e5e7eb; padding:8px; text-align:left }
      th { background:#f9fafb; font-weight:600 }
      .right { text-align:right }
      .muted { color:#6b7280 }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>${companyName}</h1>
        <div class="muted">GSTIN: ${companyGstin}</div>
      </div>
      <div class="muted">Generated: ${now}</div>
    </header>

    <section>
      <h2 style="margin-top:18px">GST Summary (${periodStart} → ${periodEnd})</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="right">Total</th>
            <th class="right">CGST</th>
            <th class="right">SGST</th>
            <th class="right">IGST</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRows
            .map(
              (c) =>
                `<tr><td>${c.category}</td><td class="right">₹${fmtINR(c.total)}</td><td class="right">₹${fmtINR(c.cgst)}</td><td class="right">₹${fmtINR(c.sgst)}</td><td class="right">₹${fmtINR(c.igst)}</td></tr>`,
            )
            .join("")}
          <tr style="font-weight:700">
            <td>Total</td>
            <td class="right">₹${fmtINR(data.totals.totalAmount)}</td>
            <td class="right">₹${fmtINR(data.totals.totalCgst)}</td>
            <td class="right">₹${fmtINR(data.totals.totalSgst)}</td>
            <td class="right">₹${fmtINR(data.totals.totalIgst)}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2 style="margin-top:18px">Detail By Vendor</h2>
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Category</th>
            <th class="right">Amount</th>
            <th class="right">Tax Type</th>
            <th class="right">Tax Amount</th>
          </tr>
        </thead>
        <tbody>
          ${detailRows
            .map((d) => {
              const taxType =
                d.igst > 0
                  ? "IGST"
                  : d.cgst > 0 || d.sgst > 0
                    ? "CGST+SGST"
                    : "—";
              return `<tr><td>${d.vendor}${d.vendorGstin ? ` (${d.vendorGstin})` : ""}</td><td>${d.category}</td><td class="right">₹${fmtINR(d.amount)}</td><td class="right">${taxType}</td><td class="right">₹${fmtINR(d.tax)}</td></tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </section>

    <footer style="margin-top:20px; color:#6b7280">This report is for GSTR-1 filing purposes. Generated ${now}.</footer>
  </body>
  </html>`;

  return html;
}

export default { renderGstHtml };
