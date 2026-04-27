import path from "path";
import { promises as fs } from "fs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import {
  createUploadedReceipt,
  findDuplicateReceiptCandidate,
} from "@/lib/repositories/receiptRepository";
import { parseReceiptWithOcrAndLlm } from "@/lib/ai/receiptParser";
import { getDefaultPolicyForTenant } from "@/lib/repositories/policyRepository";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

function getUploadDirectory(tenantId: string, userId: string): string {
  const configuredBaseDir = process.env.FILE_UPLOAD_DIR || "./public/uploads";
  return path.join(process.cwd(), configuredBaseDir, tenantId, userId);
}

function toPublicReceiptUrl(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.startsWith("./public/")) {
    return normalized.slice("./public".length);
  }

  if (normalized.startsWith("public/")) {
    return `/${normalized.slice("public/".length)}`;
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function buildOcrFingerprint(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function extractReceiptTimeFromOcr(ocrText: string): string | null {
  const normalized = ocrText.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  // Supports common formats such as 14:32, 14.32, 2:32 PM
  const match = normalized.match(
    /\b(\d{1,2})[:.](\d{2})(?:\s*([AaPp][Mm]))?\b/,
  );

  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }

    if (meridiem === "PM" && hour < 12) {
      hour += 12;
    }

    if (meridiem === "AM" && hour === 12) {
      hour = 0;
    }
  }

  if (hour > 23) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

type PolicyValidationResult = {
  violated: boolean;
  reasons: string[];
};

function extractMealAttendeeCountFromNote(note: string): number | null {
  const normalized = note.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const patterns = [
    /(\d{1,3})\s*(?:people|persons|person|attendees|attendee|pax|members)/i,
    /(?:people|persons|person|attendees|attendee|pax|members)\s*[:=\-]?\s*(\d{1,3})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const count = Number(match[1]);
    if (Number.isFinite(count) && count > 0) {
      return count;
    }
  }

  return null;
}

function normalizeCategoryForPolicy(
  category: string | null | undefined,
): string {
  const normalized = (category ?? "").trim().toLowerCase();
  return normalized || "uncategorized";
}

function readCategoryMonthlyLimits(
  rules: Record<string, unknown>,
): Record<string, number> {
  const raw = rules.categoryMonthlyLimits;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const normalized: Record<string, number> = {};

  for (const [key, value] of entries) {
    const category = key.trim().toLowerCase();
    const amount = Number(value);

    if (!category || !Number.isFinite(amount) || amount <= 0) {
      continue;
    }

    normalized[category] = amount;
  }

  return normalized;
}

function evaluatePolicy(input: {
  amount: number;
  category: string;
  rules: Record<string, unknown>;
  note: string;
}): PolicyValidationResult {
  const reasons: string[] = [];
  const category = normalizeCategoryForPolicy(input.category);

  const mealLimit = Number(input.rules.mealPerPersonDailyInr);
  const travelLimit = Number(input.rules.travelMonthlyInr);
  const miscLimit = Number(input.rules.miscMonthlyInr);
  const customCategoryLimits = readCategoryMonthlyLimits(input.rules);

  if (category === "meals" && Number.isFinite(mealLimit)) {
    const attendeeCount = extractMealAttendeeCountFromNote(input.note);

    if (!attendeeCount) {
      reasons.push(
        "Meal receipt note must include attendee count (example: 3 people).",
      );
    } else {
      const allowedAmount = mealLimit * attendeeCount;
      if (input.amount > allowedAmount) {
        reasons.push(
          `Meal limit exceeded by INR ${(input.amount - allowedAmount).toFixed(2)} for ${attendeeCount} attendee(s).`,
        );
      }
    }
  }

  if (
    category === "travel" &&
    Number.isFinite(travelLimit) &&
    input.amount > travelLimit
  ) {
    reasons.push(
      `Travel limit exceeded by INR ${(input.amount - travelLimit).toFixed(2)}`,
    );
  }

  if (
    (category === "office" || category === "uncategorized") &&
    Number.isFinite(miscLimit) &&
    input.amount > miscLimit
  ) {
    reasons.push(
      `Misc limit exceeded by INR ${(input.amount - miscLimit).toFixed(2)}`,
    );
  }

  const customLimit = customCategoryLimits[category];
  if (Number.isFinite(customLimit) && input.amount > customLimit) {
    reasons.push(
      `${category.charAt(0).toUpperCase() + category.slice(1)} limit exceeded by INR ${(input.amount - customLimit).toFixed(2)}`,
    );
  }

  return {
    violated: reasons.length > 0,
    reasons,
  };
}

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  logger.info("Receipt upload started", {
    requestId,
    route: "/api/receipts/upload",
  });

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const formData = await request.formData();
    const receiptFile = formData.get("receipt");
    const noteValue = formData.get("note");
    const allowDuplicateValue = formData.get("allowDuplicate");
    const allowPolicyOverrideValue = formData.get("allowPolicyOverride");

    if (!(receiptFile instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_FILE",
            message: "Receipt file is required.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const note = typeof noteValue === "string" ? noteValue.trim() : "";
    const allowDuplicateUpload = allowDuplicateValue === "true";
    const allowPolicyOverride = allowPolicyOverrideValue === "true";

    if (note.length < 8) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOTE_REQUIRED",
            message:
              "A contextual note is required (minimum 8 characters) before parsing.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    if (!ALLOWED_MIME_TYPES.has(receiptFile.type)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UNSUPPORTED_FILE_TYPE",
            message: "Only JPG, PNG, and PDF files are allowed.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const maxFileSize =
      parseInt(process.env.MAX_FILE_SIZE || "10485760", 10) || 10485760;

    if (receiptFile.size > maxFileSize) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "File exceeds the maximum allowed size.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await receiptFile.arrayBuffer());

    let parsed;
    try {
      parsed = await parseReceiptWithOcrAndLlm({
        fileBuffer,
        fileName: receiptFile.name,
        mimeType: receiptFile.type,
        note,
        requestId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Receipt parsing failed.";

      logger.error("Receipt parsing rejected before upload", {
        requestId,
        route: "/api/receipts/upload",
        message,
        error: error instanceof Error ? error.stack : String(error),
      });

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "RECEIPT_PARSE_FAILED",
            message,
            requestId,
          },
        },
        { status: 422 },
      );
    }

    const uploadDir = getUploadDirectory(
      authContext!.tenantId,
      authContext!.userId,
    );
    await fs.mkdir(uploadDir, { recursive: true });

    const extensionFromName = path.extname(receiptFile.name).toLowerCase();
    const extension =
      extensionFromName.length > 0
        ? extensionFromName
        : receiptFile.type === "application/pdf"
          ? ".pdf"
          : ".jpg";

    const fileId = crypto.randomUUID();
    const fileName = `${fileId}${extension}`;
    const relativePath = path
      .join(
        process.env.FILE_UPLOAD_DIR || "./public/uploads",
        authContext!.tenantId,
        authContext!.userId,
        fileName,
      )
      .replace(/\\/g, "/");

    const confidenceScore = parsed.confidenceScore;
    let status: "needs_review" | "draft" =
      confidenceScore < 0.7 ? "needs_review" : "draft";

    const ocrFingerprint = buildOcrFingerprint(parsed.ocrText);
    const extractedReceiptTime = extractReceiptTimeFromOcr(parsed.ocrText);

    logger.info("Duplicate lookup inputs", {
      requestId,
      tenantId: authContext!.tenantId,
      amount: parsed.amount,
      currency: parsed.currency,
      receiptDate: parsed.receiptDate,
      vendorGstin: parsed.vendorGstin,
      receiptTime: extractedReceiptTime,
    });

    const duplicateCandidate = await findDuplicateReceiptCandidate({
      tenantId: authContext!.tenantId,
      amount: parsed.amount,
      currency: parsed.currency,
      receiptDate: parsed.receiptDate,
      vendorGstin: parsed.vendorGstin,
      receiptTime: extractedReceiptTime,
      ocrFingerprint: ocrFingerprint,
    });

    logger.info("Duplicate lookup result", {
      requestId,
      duplicateFound: Boolean(duplicateCandidate),
      duplicateId: duplicateCandidate ? duplicateCandidate.id : null,
      duplicateVendor: duplicateCandidate ? duplicateCandidate.vendor_name : null,
    });

    // Collect violations instead of early-exiting; allow both duplicate and policy checks to run
    const duplicateOfId = duplicateCandidate ? duplicateCandidate.id : null;
    const hasDuplicateWarning = duplicateCandidate && !allowDuplicateUpload;
    
    if (duplicateOfId) {
      status = "needs_review";
    }

    let policyValidation: PolicyValidationResult = {
      violated: false,
      reasons: [],
    };
    const activePolicy = await getDefaultPolicyForTenant(authContext!.tenantId);
    if (activePolicy?.rules) {
      policyValidation = evaluatePolicy({
        amount: parsed.amount,
        category: parsed.category,
        rules: activePolicy.rules,
        note,
      });

      if (policyValidation.violated) {
        status = "needs_review";
      }
    }

    // If BOTH violations exist and neither is overridden, return combined error
    const hasPolicyWarning = policyValidation.violated && !allowPolicyOverride;

    if ((hasDuplicateWarning || hasPolicyWarning) && (hasDuplicateWarning || hasPolicyWarning)) {
      const errors: Record<string, unknown> = {};
      const errorCodes: string[] = [];

      if (hasDuplicateWarning) {
        errors.duplicate = {
          code: "DUPLICATE_RECEIPT",
          message:
            "A similar receipt already exists with matching GSTIN, amount, and date.",
          duplicateOf: {
            ...duplicateCandidate,
            file_url: toPublicReceiptUrl(duplicateCandidate!.file_path),
          },
        };
        errorCodes.push("DUPLICATE_RECEIPT");

        logger.warn("Duplicate receipt warning", {
          requestId,
          route: "/api/receipts/upload",
          tenantId: authContext!.tenantId,
          userId: authContext!.userId,
          duplicateOf: duplicateCandidate!.id,
          vendorName: parsed.vendorName,
          amount: parsed.amount,
          receiptDate: parsed.receiptDate,
        });
      }

      if (hasPolicyWarning) {
        errors.policy = {
          code: "POLICY_OVERRIDE_REQUIRED",
          message: "This receipt violates policy rules.",
          reasons: policyValidation.reasons,
        };
        errorCodes.push("POLICY_OVERRIDE_REQUIRED");

        logger.warn("Policy violation warning", {
          requestId,
          route: "/api/receipts/upload",
          tenantId: authContext!.tenantId,
          userId: authContext!.userId,
          reasons: policyValidation.reasons,
          category: parsed.category,
          amount: parsed.amount,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error: {
            code:
              errorCodes.length > 1
                ? "VALIDATION_FAILED"
                : errorCodes[0],
            message:
              errorCodes.length > 1
                ? "This receipt has both duplicate and policy violations."
                : errorCodes[0] === "DUPLICATE_RECEIPT"
                  ? "Duplicate receipt detected."
                  : "Policy violation detected.",
            requestId,
            details: errors,
          },
          data: {
            duplicateOf: hasDuplicateWarning
              ? {
                  ...duplicateCandidate,
                  file_url: toPublicReceiptUrl(duplicateCandidate!.file_path),
                }
              : undefined,
            extracted: {
              vendorName: parsed.vendorName,
              amount: parsed.amount,
              currency: parsed.currency,
              receiptDate: parsed.receiptDate,
              category: parsed.category,
              gstRate: parsed.gstRate,
              cgstRate: parsed.cgstRate,
              igstRate: parsed.igstRate,
              sgstRate: parsed.sgstRate,
              cgstAmount: parsed.cgstAmount,
              igstAmount: parsed.igstAmount,
              sgstAmount: parsed.sgstAmount,
              taxAmount: parsed.taxAmount,
              vendorGstin: parsed.vendorGstin,
              gstAmount: parsed.gstAmount,
            },
          },
        },
        { status: 409 },
      );
    }

    const parsedData = {
      source: "groq-ocr-llm",
      vendor_name: parsed.vendorName,
      amount: parsed.amount,
      currency: parsed.currency,
      receipt_date: parsed.receiptDate,
      category: parsed.category,
      gst_rate: parsed.gstRate,
      cgst_rate: parsed.cgstRate,
      igst_rate: parsed.igstRate,
      sgst_rate: parsed.sgstRate,
      cgst_amount: parsed.cgstAmount,
      igst_amount: parsed.igstAmount,
      sgst_amount: parsed.sgstAmount,
      tax_amount: parsed.taxAmount,
      vendor_gstin: parsed.vendorGstin,
      gst_amount: parsed.gstAmount,
      confidence_score: parsed.confidenceScore,
      ocr_text: parsed.ocrText,
      ocr_fingerprint: ocrFingerprint,
      note,
      parser_status: parsed.parserStatus,
      receipt_time: extractedReceiptTime,
      policy_validation: {
        violated: policyValidation.violated,
        reasons: policyValidation.reasons,
      },
      duplicate_validation: {
        suspected: Boolean(duplicateOfId),
        duplicate_of: duplicateOfId,
      },
    };

    const fullPath = path.join(uploadDir, fileName);
    await fs.writeFile(fullPath, fileBuffer);

    const createdReceipt = await createUploadedReceipt({
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
      vendorName: parsed.vendorName,
      amount: parsed.amount,
      currency: parsed.currency,
      receiptDate: parsed.receiptDate,
      category: parsed.category,
      gstRate: parsed.gstRate,
      cgstRate: parsed.cgstRate,
      igstRate: parsed.igstRate,
      sgstRate: parsed.sgstRate,
      cgstAmount: parsed.cgstAmount,
      igstAmount: parsed.igstAmount,
      sgstAmount: parsed.sgstAmount,
      taxAmount: parsed.taxAmount,
      vendorGstin: parsed.vendorGstin,
      note,
      filePath: relativePath,
      fileName: receiptFile.name,
      mimeType: receiptFile.type,
      fileSizeBytes: receiptFile.size,
      parsedData,
      confidenceScore,
      status,
      isDuplicate: Boolean(duplicateOfId),
      duplicateOf: duplicateOfId,
    });

    logger.info("Receipt uploaded and parsed", {
      requestId,
      route: "/api/receipts/upload",
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
      receiptId: createdReceipt.id,
      status: createdReceipt.status,
      parserStatus: parsed.parserStatus,
      confidenceScore: parsed.confidenceScore,
      policyViolated: policyValidation.violated,
      policyReasons: policyValidation.reasons,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId,
        message:
          "Receipt uploaded and parsed successfully with contextual note.",
        data: {
          receipt: createdReceipt,
          extracted: {
            vendorName: parsed.vendorName,
            amount: parsed.amount,
            currency: parsed.currency,
            receiptDate: parsed.receiptDate,
            category: parsed.category,
            gstRate: parsed.gstRate,
            cgstRate: parsed.cgstRate,
            igstRate: parsed.igstRate,
            sgstRate: parsed.sgstRate,
            cgstAmount: parsed.cgstAmount,
            igstAmount: parsed.igstAmount,
            sgstAmount: parsed.sgstAmount,
            taxAmount: parsed.taxAmount,
            vendorGstin: parsed.vendorGstin,
            gstAmount: parsed.gstAmount,
          },
          parser: {
            parserStatus: parsed.parserStatus,
            confidenceScore: parsed.confidenceScore,
          },
          policy: policyValidation,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload receipt.";

    logger.error("Receipt upload failed", {
      requestId,
      route: "/api/receipts/upload",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "RECEIPT_UPLOAD_FAILED",
          message,
          requestId,
        },
      },
      { status: 400 },
    );
  }
}
