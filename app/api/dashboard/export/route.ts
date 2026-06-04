import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { requireActiveWorkspace } from "@/lib/middleware/requireActiveWorkspace";
import { getTenantById, getUserById } from "@/lib/repositories/authRepository";
import { loadDashboardData } from "@/lib/repositories/dashboardRepository";
import { generateDashboardAiSummary } from "@/lib/ai/dashboardSummary";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtINR(value: number | string) {
  const num = Number(value || 0);
  return num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function fmtINRCompact(value: number | string) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function categoryColor(index: number, total: number): string {
  if (total <= 1) return "#0f172a";
  const hue = Math.round((index * 360) / total) % 360;
  const saturation = 65 + (index % 3) * 8; // 65–81%
  const lightness = 38 + (index % 2) * 10; // 38–48%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const PIE_PALETTE = [
  "#0f172a",
  "#2563eb",
  "#0f6c4b",
  "#6b7280",
  "#94a3b8",
  "#cbd5e1",
];

// ─── SVG Donut Pie ────────────────────────────────────────────────────────────

function buildPieSvg(
  segments: Array<{
    label: string;
    share: number;
    color: string;
    amount: number;
  }>,
  total: number,
  size = 200,
): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const innerR = r * 0.54;

  function polar(angleDeg: number, radius: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number) {
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const o1 = polar(startDeg, r);
    const o2 = polar(endDeg, r);
    const i1 = polar(endDeg, innerR);
    const i2 = polar(startDeg, innerR);
    return [
      `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)}`,
      `A ${r} ${r} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)}`,
      `L ${i1.x.toFixed(2)} ${i1.y.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x.toFixed(2)} ${i2.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  }

  if (segments.length === 0) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/>
      <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white"/>
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#94a3b8" font-family="system-ui">No data</text>
    </svg>`;
  }

  let cursor = 0;
  const paths = segments.map((seg) => {
    const sweep = (seg.share / 100) * 360;
    const d = arcPath(cursor, cursor + sweep);
    cursor += sweep;
    return `<path d="${d}" fill="${seg.color}" stroke="white" stroke-width="2"/>`;
  });

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    ${paths.join("\n    ")}
    <circle cx="${cx}" cy="${cy}" r="${innerR - 1}" fill="white"/>
    <text x="${cx}" y="${cy - 9}" text-anchor="middle" font-size="9" fill="#94a3b8" font-family="system-ui" letter-spacing="0.08em">TOTAL</text>
    <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a" font-family="system-ui">${fmtINRCompact(total)}</text>
  </svg>`;
}

// ─── SVG Trend Sparkline ──────────────────────────────────────────────────────

function buildTrendSvg(
  points: Array<{ label: string; amount: number }>,
  width = 520,
  height = 130,
): string {
  if (points.length === 0) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="8" fill="#f8fafc"/>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#94a3b8" font-family="system-ui">No trend data for this period</text>
    </svg>`;
  }

  const pad = { top: 14, right: 18, bottom: 32, left: 60 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxVal = Math.max(...points.map((p) => p.amount), 1);

  const xs = points.map(
    (_, i) => pad.left + (i / Math.max(points.length - 1, 1)) * plotW,
  );
  const ys = points.map((p) => pad.top + plotH - (p.amount / maxVal) * plotH);

  const polyline = xs
    .map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const area = [
    `M ${xs[0].toFixed(1)} ${(pad.top + plotH).toFixed(1)}`,
    ...xs.map((x, i) => `L ${x.toFixed(1)} ${ys[i].toFixed(1)}`),
    `L ${xs[xs.length - 1].toFixed(1)} ${(pad.top + plotH).toFixed(1)}`,
    "Z",
  ].join(" ");

  // Grid lines + y-axis labels
  const gridLines = [0, 0.5, 1].map((frac) => {
    const y = (pad.top + plotH - frac * plotH).toFixed(1);
    const val = fmtINRCompact(maxVal * frac);
    return `<line x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>
    <text x="${pad.left - 6}" y="${y}" text-anchor="end" dominant-baseline="middle" font-size="9" fill="#94a3b8" font-family="system-ui">${val}</text>`;
  });

  // X-axis labels — every Nth point
  const step = Math.max(1, Math.floor(points.length / 7));
  const xLabels = points
    .map((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return "";
      return `<text x="${xs[i].toFixed(1)}" y="${(pad.top + plotH + 16).toFixed(1)}" text-anchor="middle" font-size="8" fill="#94a3b8" font-family="system-ui">${p.label}</text>`;
    })
    .filter(Boolean);

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" rx="8" fill="#f8fafc"/>
    ${gridLines.join("\n    ")}
    <path d="${area}" fill="#10b981" fill-opacity="0.10"/>
    <polyline points="${polyline}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${xLabels.join("\n    ")}
  </svg>`;
}

// ─── HTML Renderer ────────────────────────────────────────────────────────────

function renderSummaryHtml(opts: {
  companyName: string;
  displayName: string;
  periodLabel: string;
  generatedAt: string;
  summary: {
    currentSpend: number;
    totalTax: number;
    receiptCount: number;
    averageReceipt: number;
    openReports: number;
    reviewQueue: number;
    policyIssues: number;
    duplicateReceipts: number;
    monthOverMonthChange: number | null;
  };
  categories: Array<{
    category: string;
    amount: number;
    tax: number;
    count: number;
    share: number;
  }>;
  trend: Array<{ label: string; amount: number; date: string }>;
  topContributors: Array<{
    name: string;
    totalSpend: number;
    receiptCount: number;
  }>;
  aiSummary: {
    executiveSummary?: string[];
    keyHighlights: string[];
    riskFlags?: string[];
    recommendedActions?: string[];
  };
}) {
  const {
    companyName,
    displayName,
    periodLabel,
    generatedAt,
    summary,
    categories,
    trend,
    topContributors,
  } = opts;

  const categoryTotal = categories.reduce((s, c) => s + c.amount, 0);
  const pieSegments = categories.map((c, i) => ({
    label: c.category,
    share: categoryTotal > 0 ? (c.amount / categoryTotal) * 100 : 0,
    color: categoryColor(i, categories.length),
    amount: c.amount,
  }));

  const pieSvg = buildPieSvg(pieSegments, categoryTotal);
  const trendSvg = buildTrendSvg(trend);

  const momText =
    summary.monthOverMonthChange === null
      ? "No prior period data"
      : `${summary.monthOverMonthChange > 0 ? "▲" : "▼"} ${Math.abs(summary.monthOverMonthChange).toFixed(1)}% vs previous period`;

  const momColor =
    summary.monthOverMonthChange === null
      ? "#94a3b8"
      : summary.monthOverMonthChange > 0
        ? "#ef4444"
        : "#10b981";

  const categoryTableRows =
    categories.length > 0
      ? categories
          .map(
            (c, i) => `<tr>
            <td><span class="dot" style="background:${categoryColor(i, categories.length)}"></span>${c.category}</td>
            <td class="r">${fmtINRCompact(c.amount)}</td>
            <td class="r">${fmtINRCompact(c.tax)}</td>
            <td class="r">${c.count}</td>
            <td class="r">${c.share.toFixed(1)}%</td>
          </tr>`,
          )
          .join("")
      : `<tr><td colspan="5" class="muted">No category data for this period.</td></tr>`;

  const contributorRows =
    topContributors.length > 0
      ? topContributors
          .map(
            (c, i) => `<tr>
            <td><span class="rank">${i + 1}</span>${c.name}</td>
            <td class="r">${fmtINRCompact(c.totalSpend)}</td>
            <td class="r">${c.receiptCount}</td>
          </tr>`,
          )
          .join("")
      : "";

  const metricCards = [
    {
      label: "Total Spend",
      value: `₹${fmtINR(summary.currentSpend)}`,
      note: momText,
      noteColor: momColor,
      accent: "#ecfdf5",
      border: "#6ee7b7",
    },
    {
      label: "Total Tax",
      value: `₹${fmtINR(summary.totalTax)}`,
      note: "CGST + SGST + IGST",
      noteColor: "#94a3b8",
      accent: "#eff6ff",
      border: "#93c5fd",
    },
    {
      label: "Receipts",
      value: String(summary.receiptCount),
      note: `Avg ₹${fmtINR(summary.averageReceipt)} each`,
      noteColor: "#94a3b8",
      accent: "#f5f3ff",
      border: "#c4b5fd",
    },
    {
      label: "Avg Receipt",
      value: `₹${fmtINR(summary.averageReceipt)}`,
      note: "Typical ticket size",
      noteColor: "#94a3b8",
      accent: "#f8fafc",
      border: "#cbd5e1",
    },
    {
      label: "Open Reports",
      value: String(summary.openReports),
      note: `${summary.reviewQueue} in review queue`,
      noteColor: "#94a3b8",
      accent: "#fffbeb",
      border: "#fcd34d",
    },
    {
      label: "Review Queue",
      value: String(summary.reviewQueue),
      note: "Pending action",
      noteColor: "#94a3b8",
      accent: "#fff7ed",
      border: "#fdba74",
    },
    {
      label: "Policy Issues",
      value: String(summary.policyIssues),
      note: `${summary.duplicateReceipts} duplicate(s) flagged`,
      noteColor: summary.policyIssues > 0 ? "#ef4444" : "#94a3b8",
      accent: summary.policyIssues > 0 ? "#fff1f2" : "#f8fafc",
      border: summary.policyIssues > 0 ? "#fca5a5" : "#cbd5e1",
    },
    {
      label: "Duplicates",
      value: String(summary.duplicateReceipts),
      note: "Flagged receipts",
      noteColor: "#94a3b8",
      accent: "#f8fafc",
      border: "#cbd5e1",
    },
  ]
    .map(
      (
        m,
      ) => `<div class="metric-card" style="background:${m.accent};border-color:${m.border}">
        <div class="metric-label">${m.label}</div>
        <div class="metric-value">${m.value}</div>
        <div class="metric-note" style="color:${m.noteColor}">${m.note}</div>
      </div>`,
    )
    .join("");

  const escapedKeyHighlights = (opts.aiSummary?.keyHighlights || []).map((s) => escapeHtml(s));


  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Dashboard Summary — ${companyName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #0f172a;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Screen: single-page preview with print button ── */
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 32px;
      background: #0f172a;
      color: white;
    }
    .print-bar-title { font-size: 13px; font-weight: 600; opacity: 0.9; }
    .print-bar-sub { font-size: 11px; opacity: 0.5; margin-top: 1px; }
    .print-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: #10b981; color: white; border: none; cursor: pointer;
      padding: 9px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      font-family: inherit; transition: background 0.15s;
    }
    .print-btn:hover { background: #059669; }
    .print-btn svg { width: 15px; height: 15px; }

    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 80px 40px 48px;
    }

    /* ── Header ── */
    .report-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 24px; margin-bottom: 32px;
      border-bottom: 2px solid #e2e8f0;
    }
    .report-header-left h1 { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
    .report-header-left .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .report-header-left .period-badge {
      display: inline-block; margin-top: 10px;
      background: #f0fdf4; border: 1px solid #86efac; color: #15803d;
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px;
      letter-spacing: 0.04em;
    }
    .report-header-right { text-align: right; }
    .report-header-right .gen-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; }
    .report-header-right .gen-value { font-size: 12px; color: #475569; margin-top: 3px; }

    /* ── Section headings ── */
    .section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.12em; color: #64748b;
      margin: 36px 0 14px;
      display: flex; align-items: center; gap: 8px;
    }
    .section-title::after {
      content: ''; flex: 1; height: 1px; background: #e2e8f0;
    }

    /* ── Simplified AI summary ── */
    .ai-simple { display: flex; gap: 16px; align-items: flex-start; margin-top: 8px; }
    .ai-highlights { flex: 1; }
    .ai-highlights ul { padding-left: 18px; color: #0f172a; font-size: 13px; line-height: 1.6; }
    .ai-stats { width: 220px; display: flex; flex-direction: column; gap: 8px; }
    .ai-stat { padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .ai-stat .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .ai-stat .value { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 6px; }

    /* ── Metric cards ── */
    .metrics-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
    }
    .metric-card {
      border: 1px solid; border-radius: 10px; padding: 14px 16px;
    }
    .metric-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; color: #64748b; margin-bottom: 6px; }
    .metric-value { font-size: 19px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
    .metric-note { font-size: 10px; margin-top: 5px; }

    /* ── Category section ── */
    .category-layout {
      display: grid; grid-template-columns: 220px 1fr; gap: 28px; align-items: start;
    }
    .pie-col { display: flex; flex-direction: column; align-items: center; gap: 14px; }
    .legend { width: 100%; }
    .legend-item {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; color: #374151; padding: 4px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .legend-item:last-child { border-bottom: none; }
    .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; vertical-align: middle; }
    .legend-share { margin-left: auto; font-weight: 600; color: #0f172a; font-size: 11px; }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    thead tr { background: #f8fafc; }
    th {
      padding: 9px 12px; text-align: left; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;
      border-bottom: 2px solid #e2e8f0;
    }
    td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; color: #374151; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    .r { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #94a3b8; font-style: italic; }
    .rank {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      background: #f1f5f9; color: #475569; font-size: 9px; font-weight: 700;
      margin-right: 8px; vertical-align: middle;
    }

    /* ── Trend ── */
    .trend-wrap { border-radius: 10px; overflow: hidden; }

    /* ── Footer ── */
    .report-footer {
      margin-top: 48px; padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between;
      font-size: 10px; color: #94a3b8;
    }

    /* ── Print overrides ── */
    @media print {
      .print-bar { display: none !important; }
      .page { padding: 24px 32px; max-width: 100%; }
      body { font-size: 11px; }
      .metrics-grid { grid-template-columns: repeat(4, 1fr); }
      .category-layout { grid-template-columns: 200px 1fr; }
      @page { margin: 12mm 14mm; size: A4; }
    }
  </style>
</head>
<body>

  <!-- Screen-only print bar -->
  <div class="print-bar">
    <div>
      <div class="print-bar-title">Dashboard Summary Report</div>
      <div class="print-bar-sub">${companyName} · ${periodLabel}</div>
    </div>
    <button class="print-btn" onclick="window.print()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>
      Save as PDF
    </button>
  </div>

  <div class="page">

    <!-- Header -->
    <div class="report-header">
      <div class="report-header-left">
        <h1>${companyName}</h1>
        <div class="subtitle">Dashboard Summary Report &nbsp;·&nbsp; Prepared for ${displayName}</div>
        <div class="period-badge">${periodLabel}</div>
      </div>
      <div class="report-header-right">
        <div class="gen-label">Generated</div>
        <div class="gen-value">${generatedAt}</div>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="section-title">Key Metrics</div>
    <div class="metrics-grid">
      ${metricCards}
    </div>

    <!-- AI Summary (simplified) -->
    <div class="section-title">AI Summary</div>
    <div class="ai-simple">
      <div class="ai-highlights">
        <div class="ai-card">
          <h4 style="margin-bottom:8px">Key Highlights</h4>
          <ul>
            ${escapedKeyHighlights.length > 0 ? escapedKeyHighlights.map((h) => `<li>${h}</li>`).join("") : `<li class="muted">No highlights available</li>`}
          </ul>
        </div>
      </div>
      <div class="ai-stats">
        <div class="ai-stat">
          <div class="label">Current Spend</div>
          <div class="value">₹${fmtINR(summary.currentSpend)}</div>
        </div>
        <div class="ai-stat">
          <div class="label">Total Tax</div>
          <div class="value">₹${fmtINR(summary.totalTax)}</div>
        </div>
      </div>
    </div>

    <!-- Spend by Category -->
    <div class="section-title">Spend by Category</div>
    <div class="category-layout">
      <div class="pie-col">
        ${pieSvg}
        <div class="legend">
          ${pieSegments
            .map(
              (s) => `<div class="legend-item">
              <span class="dot" style="background:${s.color}"></span>
              <span>${s.label}</span>
              <span class="legend-share">${s.share.toFixed(1)}%</span>
            </div>`,
            )
            .join("")}
        </div>
      </div>
      <div>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="r">Amount</th>
              <th class="r">Tax</th>
              <th class="r">Receipts</th>
              <th class="r">Share</th>
            </tr>
          </thead>
          <tbody>${categoryTableRows}</tbody>
        </table>
      </div>
    </div>

    <!-- Spend Trend -->
    <div class="section-title">Spend Trend</div>
    <div class="trend-wrap">${trendSvg}</div>

    ${
      topContributors.length > 0
        ? `<!-- Top Contributors -->
    <div class="section-title">Top Contributors</div>
    <table>
      <thead>
        <tr>
          <th>Team Member</th>
          <th class="r">Total Spend</th>
          <th class="r">Receipts</th>
        </tr>
      </thead>
      <tbody>${contributorRows}</tbody>
    </table>`
        : ""
    }

    <!-- Footer -->
    <div class="report-footer">
      <span>${companyName} &nbsp;·&nbsp; Dashboard Summary Report &nbsp;·&nbsp; ${periodLabel}</span>
      <span>Generated ${generatedAt}</span>
    </div>

  </div>

  <script>
    // Auto-trigger print dialog when opened in a new tab
    window.addEventListener('load', function() {
      // Small delay so the page renders fully before the dialog opens
      setTimeout(function() { window.print(); }, 400);
    });
  </script>

</body>
</html>`;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

/**
 * GET /api/dashboard/export
 * Opens a print-ready HTML page in a new tab; browser PDF dialog fires automatically.
 * Query params: dateRange (monthly|all-time|custom), startDate, endDate
 */
export async function GET(request: NextRequest) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Dashboard export request started", {
    requestId,
    route: "/api/dashboard/export",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext, "employee", "manager", "admin");

    const guard = await requireActiveWorkspace(authContext!, requestId);
    if (guard) return guard;

    const sp = request.nextUrl.searchParams;
    const dateRangeMode =
      (sp.get("dateRange") as "monthly" | "all-time" | "custom") || "monthly";
    const customStartDate = sp.get("startDate") ?? undefined;
    const customEndDate = sp.get("endDate") ?? undefined;

    const [user, tenant] = await Promise.all([
      getUserById(authContext!.userId),
      getTenantById(authContext!.tenantId),
    ]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const displayName = user
      ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
        (user as { email?: string }).email ||
        "User"
      : "Workspace user";

    const role = authContext!.role as "employee" | "manager" | "admin";

    const dashboard = await loadDashboardData({
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
      role,
      receiptQuotaMonthly: tenant.receipt_quota_monthly,
      trialEndsAt: tenant.trial_ends_at ?? null,
      dateRangeMode,
      customStartDate,
      customEndDate,
    });

    const now = new Date();
    const periodLabel =
      dateRangeMode === "all-time"
        ? "All time"
        : dateRangeMode === "custom" && customStartDate && customEndDate
          ? `${customStartDate} to ${customEndDate}`
          : now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    const generatedAt = now.toLocaleString("en-IN", {
      dateStyle: "long",
      timeStyle: "short",
    });

    const aiSummary = await generateDashboardAiSummary({
      companyName: tenant.name || "Workspace",
      periodLabel,
      summary: dashboard.summary,
      categories: dashboard.categories,
      trend: dashboard.trend,
      topContributors: dashboard.topContributors,
    });

    const html = renderSummaryHtml({
      companyName: tenant.name || "Workspace",
      displayName: displayName ?? "User",
      periodLabel,
      generatedAt,
      summary: dashboard.summary,
      categories: dashboard.categories,
      trend: dashboard.trend,
      topContributors: dashboard.topContributors,
      aiSummary,
    });

    // Serve as inline HTML — the page opens in a new tab and auto-prints
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // No Content-Disposition so the browser renders it inline
      },
    });
  } catch (error) {
    logger.error("Failed to export dashboard summary", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to export dashboard summary" },
      { status: 500 },
    );
  }
}
