import Groq from "groq-sdk";
// `pdf-parse` (which uses pdfjs) is lazily imported inside
// `extractTextFromPdfSafely` after attempting to provide minimal
// DOM/canvas shims on serverless platforms (Vercel) to avoid
// ReferenceError: DOMMatrix is not defined during module evaluation.
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import logger from "@/lib/utils/logger";
import {
  buildReceiptStructuringUserPrompt,
  RECEIPT_IMAGE_OCR_SYSTEM_PROMPT,
  RECEIPT_IMAGE_OCR_USER_PROMPT,
  RECEIPT_STRUCTURING_SYSTEM_PROMPT,
} from "@/lib/ai/prompts";

export type ParsedReceiptData = {
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
  gstAmount: number | null;
  confidenceScore: number;
  ocrText: string;
  parserStatus: "completed";
};

function extractGstinFromText(text: string): string | null {
  if (!text || typeof text !== "string") return null;
  // GSTIN pattern: 2 digits state code + 10 char PAN + 1 entity + 1 checksum (15 total)
  const matches = text.toUpperCase().match(/\b[0-9]{2}[A-Z0-9]{13}\b/g);

  if (matches) {
    const validMatch = matches.find((candidate) => isValidGstin(candidate));
    if (validMatch) {
      return validMatch.replace(/\s+/g, "");
    }
  }

  return null;
}

type ParseInput = {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  note: string;
  requestId?: string;
};

const FALLBACK_CURRENCY = "INR";
let pdfWorkerConfigured = false;
let pdfWorkerUrl: string | null = null;

function configurePdfWorker(context: { fileName: string; requestId?: string }) {
  if (pdfWorkerConfigured) {
    return;
  }

  try {
    const workerPath = path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.worker.mjs",
    );

    if (!fs.existsSync(workerPath)) {
      logger.warn("PDF worker file not found for pdf-parse", {
        requestId: context.requestId,
        fileName: context.fileName,
        workerPath,
      });
      return;
    }

    const workerUrl = pathToFileURL(workerPath).toString();
    pdfWorkerUrl = workerUrl;

    logger.info("Configured pdf-parse worker for Node runtime", {
      requestId: context.requestId,
      fileName: context.fileName,
      workerUrl,
    });
  } catch (error) {
    logger.error("Failed to configure pdf-parse worker", {
      requestId: context.requestId,
      fileName: context.fileName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

function resolveGroqModel(
  configuredModel: string | undefined,
  fallbackModel: string,
): string {
  const model = configuredModel?.trim();

  if (!model) {
    return fallbackModel;
  }

  if (model === "mixtral-8x7b-32768") {
    logger.warn("Deprecated Groq model remapped", {
      configuredModel: model,
      replacementModel: fallbackModel,
    });
    return fallbackModel;
  }

  if (model === "llama-3.2-11b-vision-preview") {
    const replacement = "meta-llama/llama-4-scout-17b-16e-instruct";
    logger.warn("Deprecated Groq vision model remapped", {
      configuredModel: model,
      replacementModel: replacement,
    });
    return replacement;
  }

  return model;
}

function clampConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 0.62;
  }

  return Math.max(0, Math.min(1, numeric));
}

function normalizeTaxComponent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return numeric;
}

function normalizeCategory(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (["meals", "travel", "office", "software", "utilities"].includes(raw)) {
    return raw;
  }

  if (raw.includes("meal") || raw.includes("food")) {
    return "meals";
  }

  if (
    raw.includes("travel") ||
    raw.includes("taxi") ||
    raw.includes("flight")
  ) {
    return "travel";
  }

  if (raw.includes("office") || raw.includes("stationery")) {
    return "office";
  }

  return "uncategorized";
}

function normalizeDate(value: unknown): string {
  const fallback = new Date().toISOString().slice(0, 10);

  if (typeof value !== "string") {
    return fallback;
  }

  const candidate = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    return candidate;
  }

  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeGstin(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const compact = value.trim().toUpperCase().replace(/\s+/g, "");
  if (compact.length === 0) {
    return null;
  }

  return isValidGstin(compact) ? compact : null;
}

function isValidGstin(value: string): boolean {
  const compact = value.trim().toUpperCase().replace(/\s+/g, "");

  if (!/^[0-9]{2}[A-Z0-9]{13}$/.test(compact) || compact.length !== 15) {
    return false;
  }

  const expectedChecksum = computeGstinCheckDigit(compact.slice(0, 14));
  return expectedChecksum === compact.slice(14);
}

function computeGstinCheckDigit(payload: string): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const charToValue = (char: string) => alphabet.indexOf(char);
  const valueToChar = (value: number) => alphabet[value] ?? "";

  let factor = 2;
  let sum = 0;

  for (let index = payload.length - 1; index >= 0; index -= 1) {
    const codePoint = charToValue(payload[index]);
    if (codePoint < 0) {
      return "";
    }

    let addend = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    addend = Math.floor(addend / 36) + (addend % 36);
    sum += addend;
  }

  const checkCode = (36 - (sum % 36)) % 36;
  return valueToChar(checkCode);
}

function stripCodeFence(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

async function extractTextFromPdfSafely(
  fileBuffer: Buffer,
  context: { fileName: string; requestId?: string },
): Promise<string> {
  try {
    // Protect serverless function memory/runtime by rejecting abnormally large PDFs.
    const maxPdfBytes =
      parseInt(process.env.MAX_FILE_SIZE || "10485760", 10) || 10485760;
    if (fileBuffer.byteLength > maxPdfBytes) {
      logger.error("PDF parsing aborted: file too large", {
        requestId: context.requestId,
        fileName: context.fileName,
        fileSize: fileBuffer.byteLength,
        maxPdfBytes,
      });
      return "";
    }

    // Ensure minimal DOM/canvas globals exist to prevent pdfjs from
    // throwing during module evaluation on serverless platforms.
    try {
      // Try to load a native canvas implementation if available without
      // letting the bundler statically analyze the require call.
      // This avoids Turbopack trying to bundle native assets from @napi-rs/canvas.
      // eslint-disable-next-line no-eval
      const nativeRequire = eval(
        "typeof require !== 'undefined' ? require : undefined",
      );
      if (typeof nativeRequire === "function") {
        nativeRequire("@napi-rs/canvas");
        logger.info("Loaded @napi-rs/canvas (if available)", {
          requestId: context.requestId,
          fileName: context.fileName,
        });
      }
    } catch (err) {
      // Not fatal — we'll provide lightweight shims below to avoid runtime errors.
      logger.debug("@napi-rs/canvas not available", {
        requestId: context.requestId,
        fileName: context.fileName,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Minimal shims to prevent ReferenceError during pdfjs import.
    if (typeof (globalThis as any).DOMMatrix === "undefined") {
      (globalThis as any).DOMMatrix = class DOMMatrix {
        constructor() {}
      };
    }

    if (typeof (globalThis as any).ImageData === "undefined") {
      (globalThis as any).ImageData = class ImageData {
        constructor() {}
      };
    }

    if (typeof (globalThis as any).Path2D === "undefined") {
      (globalThis as any).Path2D = class Path2D {
        constructor() {}
      };
    }

    configurePdfWorker(context);

    // Lazy-import pdf-parse after shimming globals to avoid early pdfjs evaluation
    // which expects DOM APIs to exist.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParseMod = await import("pdf-parse");
    // Support both named and default exports depending on package build.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFParseClass: any =
      (pdfParseMod as any).PDFParse ||
      (pdfParseMod as any).default ||
      (pdfParseMod as any);

    // If a worker URL was discovered earlier, attach it to the library now.
    if (pdfWorkerUrl && !pdfWorkerConfigured) {
      try {
        if (typeof PDFParseClass.setWorker === "function") {
          PDFParseClass.setWorker(pdfWorkerUrl);
          pdfWorkerConfigured = true;
          logger.info("pdf-parse worker attached", {
            requestId: context.requestId,
            fileName: context.fileName,
            workerUrl: pdfWorkerUrl,
          });
        }
      } catch (err) {
        logger.warn("Failed to attach pdf-parse worker", {
          requestId: context.requestId,
          fileName: context.fileName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const parser = new PDFParseClass({ data: fileBuffer });
    try {
      const result = await parser.getText({
        // Keep extraction bounded to avoid runaway latency/memory on huge PDFs.
        first: 30,
        lineEnforce: true,
      });

      const extractedText = result.text?.trim() || "";
      if (!extractedText) {
        logger.error("PDF parsing returned empty text", {
          requestId: context.requestId,
          fileName: context.fileName,
          pageCount: result.total,
        });
      } else {
        logger.info("PDF text extracted successfully", {
          requestId: context.requestId,
          fileName: context.fileName,
          pageCount: result.total,
          textLength: extractedText.length,
        });
      }

      return extractedText;
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    logger.error("PDF text extraction failed", {
      requestId: context.requestId,
      fileName: context.fileName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return "";
  }
}

function isPdfImageOnlyOrUnreadable(text: string): boolean {
  const compact = text.replace(/\s+/g, "").trim();
  return compact.length === 0;
}

async function extractTextFromImageWithGroq(
  groq: Groq,
  fileBuffer: Buffer,
  mimeType: string,
  context: { fileName: string; requestId?: string },
): Promise<string> {
  const dataUri = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
  const visionModel = resolveGroqModel(
    process.env.GROQ_VISION_MODEL,
    "meta-llama/llama-4-scout-17b-16e-instruct",
  );
  const messageContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: RECEIPT_IMAGE_OCR_USER_PROMPT,
    },
    { type: "image_url", image_url: { url: dataUri } },
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: visionModel,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: RECEIPT_IMAGE_OCR_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: messageContent,
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() || "";
  } catch (error) {
    logger.error("Groq OCR failed for receipt image", {
      requestId: context.requestId,
      fileName: context.fileName,
      mimeType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return "";
  }
}

async function structureReceiptWithGroq(
  groq: Groq,
  ocrText: string,
  note: string,
  context: { fileName: string; requestId?: string },
): Promise<ParsedReceiptData> {
  const model = resolveGroqModel(
    process.env.GROQ_MODEL,
    "llama-3.3-70b-versatile",
  );

  try {
    const completion = await groq.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: RECEIPT_STRUCTURING_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildReceiptStructuringUserPrompt({ ocrText, note }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      const error = new Error("Groq returned no structured receipt payload");
      logger.error("Groq returned no structured receipt payload", {
        requestId: context.requestId,
        fileName: context.fileName,
      });
      throw error;
    }

    const parsed = JSON.parse(stripCodeFence(raw)) as Record<string, unknown>;

    const amountCandidate = Number(parsed.amount);
    const gstRateCandidate =
      parsed.gst_rate === null || parsed.gst_rate === undefined
        ? null
        : Number(parsed.gst_rate);
    const cgstRateCandidate = normalizeTaxComponent(parsed.cgst_rate);
    const igstRateCandidate = normalizeTaxComponent(parsed.igst_rate);
    const sgstRateCandidate = normalizeTaxComponent(parsed.sgst_rate);
    const cgstAmountCandidate = normalizeTaxComponent(parsed.cgst_amount);
    const igstAmountCandidate = normalizeTaxComponent(parsed.igst_amount);
    const sgstAmountCandidate = normalizeTaxComponent(parsed.sgst_amount);
    const gstAmountCandidate =
      parsed.gst_amount === null || parsed.gst_amount === undefined
        ? null
        : Number(parsed.gst_amount);
    const taxAmountCandidate =
      parsed.tax_amount === null || parsed.tax_amount === undefined
        ? null
        : Number(parsed.tax_amount);

    // If the model output is missing or invalid, fall back to a checksum-verified OCR GSTIN.
    const gstFromOcr = extractGstinFromText(ocrText);
    const finalGstin = normalizeGstin(parsed.vendor_gstin) ?? gstFromOcr;

    return {
      vendorName:
        typeof parsed.vendor_name === "string" &&
        parsed.vendor_name.trim().length > 0
          ? parsed.vendor_name.trim().slice(0, 255)
          : "Unknown vendor",
      amount:
        Number.isFinite(amountCandidate) && amountCandidate >= 0
          ? amountCandidate
          : 0,
      currency:
        typeof parsed.currency === "string" && parsed.currency.trim().length > 0
          ? parsed.currency.trim().toUpperCase()
          : FALLBACK_CURRENCY,
      receiptDate: normalizeDate(parsed.receipt_date),
      category: normalizeCategory(parsed.category),
      gstRate:
        gstRateCandidate !== null && Number.isFinite(gstRateCandidate)
          ? gstRateCandidate
          : null,
      cgstRate: cgstRateCandidate,
      igstRate: igstRateCandidate,
      sgstRate: sgstRateCandidate,
      cgstAmount: cgstAmountCandidate,
      igstAmount: igstAmountCandidate,
      sgstAmount: sgstAmountCandidate,
      taxAmount:
        taxAmountCandidate !== null && Number.isFinite(taxAmountCandidate)
          ? taxAmountCandidate
          : gstAmountCandidate !== null && Number.isFinite(gstAmountCandidate)
            ? gstAmountCandidate
            : null,
      vendorGstin: finalGstin,
      gstAmount:
        gstAmountCandidate !== null && Number.isFinite(gstAmountCandidate)
          ? gstAmountCandidate
          : null,
      confidenceScore: clampConfidence(parsed.confidence_score),
      ocrText,
      parserStatus: "completed",
    };
  } catch (error) {
    logger.error("Groq structured receipt parsing failed", {
      requestId: context.requestId,
      fileName: context.fileName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function parseReceiptWithOcrAndLlm(
  input: ParseInput,
): Promise<ParsedReceiptData> {
  const apiKey = process.env.GROQ_API_KEY;
  let ocrText = "";

  if (!apiKey) {
    const error = new Error("GROQ_API_KEY is missing");
    logger.error("Receipt parsing aborted: missing Groq API key", {
      requestId: input.requestId,
      fileName: input.fileName,
    });
    throw error;
  }

  const groq = new Groq({ apiKey });

  if (input.mimeType === "application/pdf") {
    try {
      ocrText = await extractTextFromPdfSafely(input.fileBuffer, {
        fileName: input.fileName,
        requestId: input.requestId,
      });

      if (isPdfImageOnlyOrUnreadable(ocrText)) {
        const error = new Error(
          "PDF appears image-only or unreadable. Upload image receipts (JPG/PNG) or a text-based PDF.",
        );
        logger.error("Receipt parsing aborted: unsupported PDF OCR mode", {
          requestId: input.requestId,
          fileName: input.fileName,
          mimeType: input.mimeType,
        });
        throw error;
      }
    } catch (error) {
      logger.error("Unhandled PDF extraction error", {
        requestId: input.requestId,
        fileName: input.fileName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      ocrText = "";
    }
  }

  if (!ocrText && input.mimeType.startsWith("image/")) {
    try {
      ocrText = await extractTextFromImageWithGroq(
        groq,
        input.fileBuffer,
        input.mimeType,
        {
          fileName: input.fileName,
          requestId: input.requestId,
        },
      );
    } catch (error) {
      logger.error("Unhandled image OCR error", {
        requestId: input.requestId,
        fileName: input.fileName,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      ocrText = "";
    }
  }

  if (!ocrText) {
    const error = new Error("No OCR text was extracted from the receipt");
    logger.error("Receipt parsing aborted: OCR text missing", {
      requestId: input.requestId,
      fileName: input.fileName,
      mimeType: input.mimeType,
    });
    throw error;
  }

  return structureReceiptWithGroq(groq, ocrText, input.note, {
    fileName: input.fileName,
    requestId: input.requestId,
  });
}
