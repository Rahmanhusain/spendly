import Groq from "groq-sdk";
import logger from "@/lib/utils/logger";
import {
  buildDashboardSummaryUserPrompt,
  DASHBOARD_SUMMARY_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";

export type DashboardAiSummary = {
  executiveSummary: string[];
  keyHighlights: string[];
  riskFlags: string[];
  recommendedActions: string[];
};

const DEFAULT_DASHBOARD_MODEL = "llama-3.3-70b-versatile";

function resolveGroqModel(configuredModel: string | undefined): string {
  return configuredModel?.trim() || DEFAULT_DASHBOARD_MODEL;
}

function isGroqModelDecommissionedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /model_decommissioned|decommissioned/i.test(error.message);
}

function normalizeLines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function fallbackSummary(input: {
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
  periodLabel: string;
}): DashboardAiSummary {
  const trendWord =
    input.summary.monthOverMonthChange === null
      ? "There is no previous period comparison for this export."
      : input.summary.monthOverMonthChange >= 0
        ? `Spend is up ${input.summary.monthOverMonthChange.toFixed(1)}% versus the previous period.`
        : `Spend is down ${Math.abs(input.summary.monthOverMonthChange).toFixed(1)}% versus the previous period.`;

  return {
    executiveSummary: [
      `This dashboard export covers ${input.periodLabel}.`,
      `It includes ${input.summary.receiptCount} receipts and total spend of ₹${input.summary.currentSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.`,
      trendWord,
    ],
    keyHighlights: [
      `Total tax collected is ₹${input.summary.totalTax.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.`,
      `Average receipt value is ₹${input.summary.averageReceipt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.`,
      `${input.summary.openReports} report(s) are currently open and ${input.summary.reviewQueue} are waiting in review.`,
    ],
    riskFlags: [
      `${input.summary.policyIssues} policy issue(s) were flagged.`,
      `${input.summary.duplicateReceipts} duplicate receipt(s) were detected.`,
    ],
    recommendedActions: [
      "Review the highest-spend categories and follow up on any unusual spikes.",
      "Clear the review queue before closing the reporting period.",
      "Investigate policy issues and duplicate receipts before export sign-off.",
    ],
  };
}

async function createDashboardSummary(
  groq: Groq,
  model: string,
  input: {
    companyName: string;
    periodLabel: string;
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
  },
): Promise<DashboardAiSummary> {
  const completion = await groq.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: DASHBOARD_SUMMARY_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildDashboardSummaryUserPrompt(input),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    return fallbackSummary(input);
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    executiveSummary: normalizeLines(parsed.executive_summary),
    keyHighlights: normalizeLines(parsed.key_highlights),
    riskFlags: normalizeLines(parsed.risk_flags),
    recommendedActions: normalizeLines(parsed.recommended_actions),
  };
}

export async function generateDashboardAiSummary(input: {
  companyName: string;
  periodLabel: string;
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
}): Promise<DashboardAiSummary> {
  const apiKey = process.env.GROQ_API_KEY;
  const configuredModel = resolveGroqModel(process.env.GROQ_MODEL);

  if (!apiKey) {
    return fallbackSummary(input);
  }

  const groq = new Groq({ apiKey });

  try {
    return await createDashboardSummary(groq, configuredModel, input);
  } catch (error) {
    if (
      configuredModel !== DEFAULT_DASHBOARD_MODEL &&
      isGroqModelDecommissionedError(error)
    ) {
      logger.warn("Deprecated Groq dashboard model remapped", {
        configuredModel,
        replacementModel: DEFAULT_DASHBOARD_MODEL,
      });

      try {
        return await createDashboardSummary(
          groq,
          DEFAULT_DASHBOARD_MODEL,
          input,
        );
      } catch (fallbackError) {
        logger.warn("Dashboard AI summary generation failed, using fallback", {
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        });
        return fallbackSummary(input);
      }
    }

    logger.warn("Dashboard AI summary generation failed, using fallback", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackSummary(input);
  }
}
