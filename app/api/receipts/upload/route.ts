import path from "path";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { requireActiveWorkspace } from "@/lib/middleware/requireActiveWorkspace";
import {
  createUploadedReceipt,
  findDuplicateReceiptCandidate,
} from "@/lib/repositories/receiptRepository";
import { parseReceiptWithOcrAndLlm } from "@/lib/ai/receiptParser";
import { getDefaultPolicyForTenant } from "@/lib/repositories/policyRepository";
import { getUsersByTenant } from "@/lib/repositories/authRepository";
import { sendNotification } from "@/lib/utils/notifications";
import logger from "@/lib/utils/logger";
import {
  getStoredReceiptFileUrl,
  storeReceiptFile,
} from "@/lib/storage/receipt-storage";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

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

    const guard = await requireActiveWorkspace(authContext!, requestId);
    if (guard) return guard;

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

    // Heuristic: ensure parsed result looks like a receipt. Accept documents with vendor, amount, and date.
    // GST evidence is optional now — not all vendors issue GST invoices (e.g., small vendors, services).
    const ocrText = (parsed?.ocrText ?? "").toString();
    const ocrLength = ocrText.replace(/\s+/g, "").length;
    const hasAmount = Number.isFinite(parsed?.amount) && parsed.amount > 0;
    const vendorDetected =
      typeof parsed?.vendorName === "string" &&
      parsed.vendorName.trim().length > 0 &&
      parsed.vendorName.trim().toLowerCase() !== "unknown vendor";
    const hasDate =
      parsed?.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.receiptDate);

    // Detect GSTIN (Indian GSTIN pattern: 15 chars with state code + PAN + entity + Z + checksum)
    const gstinRegex = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i;
    const gstinPresent = gstinRegex.test(ocrText);

    // Detect GST/CGST/SGST/IGST rates like 'CGST 9%','GST 18%', 'GST @ 18%', '18% GST', etc.
    const gstRateNearbyRegex =
      /(?:cgst|sgst|igst|gst|tax|rate)\s*[:@=]?\s*\d{1,2}(?:\.\d+)?\s*%/i;
    const percentBeforeGstRegex =
      /\d{1,2}(?:\.\d+)?\s*%\s*(?:cgst|sgst|igst|gst|tax|rate)/i;
    const gstRatePresent =
      gstRateNearbyRegex.test(ocrText) || percentBeforeGstRegex.test(ocrText);

    // Exclude common academic document keywords (only reject if explicitly academic)
    const academicKeywords = [
      "college",
      "bonafide",
      "certificate",
      "student",
      "roll",
      "semester",
      "university",
      "institute",
      "admission",
      "marks",
      "grade",
    ];
    const containsAcademic = academicKeywords.some((k) =>
      ocrText.toLowerCase().includes(k),
    );

    const hasReceiptKeywords =
      /\b(total|subtotal|amount|invoice|rupees|\u20b9|tax|bill|receipt|charge|price|cost|fee)\b/i.test(
        ocrText,
      );

    // Accept if: parsed successfully AND (has vendor + amount + date + either gst evidence or reasonable keywords)
    // OR: has high confidence + vendor + amount + receipt keywords (no GST required)
    const hasGstEvidence = gstinPresent || gstRatePresent;
    const likelyReceipt =
      Boolean(parsed && parsed.parserStatus === "completed") &&
      vendorDetected &&
      hasAmount &&
      hasDate &&
      (hasGstEvidence || // If GST evidence present, accept
        ((parsed.confidenceScore ?? 0) >= 0.5 && // Lower confidence threshold
          ocrLength > 50 && // Lower OCR text threshold
          hasReceiptKeywords)); // Must have receipt keywords to be safe

    // Only reject academic documents (strict rejection)
    if (containsAcademic && !hasGstEvidence && !hasReceiptKeywords) {
      logger.warn(
        "Uploaded file rejected: appears to be academic document (no receipt indicators)",
        {
          requestId,
          fileName: receiptFile.name,
          mimeType: receiptFile.type,
          ocrLength,
          confidence: parsed?.confidenceScore,
          vendorDetected,
          hasAmount,
          hasDate,
          hasReceiptKeywords,
        },
      );

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOT_A_RECEIPT",
            message:
              "Document appears to be academic (certificate, bonafide, etc.), not a business receipt/invoice. Please upload a receipt or invoice instead.",
            requestId,
          },
        },
        { status: 422 },
      );
    }

    if (!likelyReceipt) {
      logger.warn(
        "Uploaded file rejected: does not have vendor, amount, date, or receipt keywords",
        {
          requestId,
          fileName: receiptFile.name,
          mimeType: receiptFile.type,
          ocrLength,
          confidence: parsed?.confidenceScore,
          vendorDetected,
          hasAmount,
          hasDate,
          hasReceiptKeywords,
        },
      );

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "NOT_A_RECEIPT",
            message:
              "Uploaded file does not appear to be a receipt/invoice. Please ensure it contains vendor name, amount, and date.",
            requestId,
          },
        },
        { status: 422 },
      );
    }

    const extensionFromName = path.extname(receiptFile.name).toLowerCase();
    const extension =
      extensionFromName.length > 0
        ? extensionFromName
        : receiptFile.type === "application/pdf"
          ? ".pdf"
          : ".jpg";

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
      duplicateVendor: duplicateCandidate
        ? duplicateCandidate.vendor_name
        : null,
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

    if (
      (hasDuplicateWarning || hasPolicyWarning) &&
      (hasDuplicateWarning || hasPolicyWarning)
    ) {
      const errors: Record<string, unknown> = {};
      const errorCodes: string[] = [];

      if (hasDuplicateWarning) {
        errors.duplicate = {
          code: "DUPLICATE_RECEIPT",
          message:
            "A similar receipt already exists with matching GSTIN, amount, and date.",
          duplicateOf: {
            ...duplicateCandidate,
            file_url: await getStoredReceiptFileUrl(
              duplicateCandidate!.file_path,
            ),
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
            code: errorCodes.length > 1 ? "VALIDATION_FAILED" : errorCodes[0],
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
                  file_url: await getStoredReceiptFileUrl(
                    duplicateCandidate!.file_path,
                  ),
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

    const storedFile = await storeReceiptFile({
      tenantId: authContext!.tenantId,
      userId: authContext!.userId,
      fileBuffer,
      fileName: receiptFile.name,
      contentType: receiptFile.type,
      extension,
    });

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
      filePath: storedFile.storagePath,
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

    // Send notification to uploader confirming successful upload
    try {
      const statusMessage =
        createdReceipt.status === "draft"
          ? "Receipt uploaded successfully and ready to use."
          : createdReceipt.status === "needs_review"
            ? "Receipt uploaded. Needs review by managers."
            : "Receipt uploaded successfully.";

      await sendNotification({
        tenantId: authContext!.tenantId,
        userId: authContext!.userId,
        channel: "in_app",
        title: "Receipt uploaded",
        message: `${parsed.vendorName || "Receipt"} (INR ${parsed.amount.toFixed(2)}) - ${statusMessage}`,
        relatedType: "receipt",
        relatedId: createdReceipt.id,
      });

      logger.info("Receipt upload confirmation sent to uploader", {
        requestId,
        route: "/api/receipts/upload",
        receiptId: createdReceipt.id,
        uploaderId: authContext!.userId,
      });
    } catch (notificationError) {
      logger.error("Failed to send receipt upload confirmation", {
        requestId,
        route: "/api/receipts/upload",
        receiptId: createdReceipt.id,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }

    // Notify approvers (admin/manager) for every new upload.
    // This ensures approval profiles always see new receipt activity.
    try {
      const tenantUsers = await getUsersByTenant(authContext!.tenantId);
      const uploader = tenantUsers.find((u) => u.id === authContext!.userId);
      const uploaderName = [uploader?.first_name, uploader?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim();
      const managersAndAdmins = tenantUsers.filter(
        (u) =>
          (u.role === "admin" || u.role === "manager") &&
          u.id !== authContext!.userId,
      );

      const reasonsList: string[] = [];
      if (parsed.confidenceScore < 0.7) {
        reasonsList.push(
          `Low confidence score (${(parsed.confidenceScore * 100).toFixed(1)}%)`,
        );
      }
      if (policyValidation.violated) {
        reasonsList.push("Policy violation");
      }
      if (Boolean(duplicateOfId)) {
        reasonsList.push("Potential duplicate receipt");
      }

      const notificationTitle =
        createdReceipt.status === "needs_review"
          ? "New receipt uploaded (needs review)"
          : "New receipt uploaded";

      const baseMessage = `${uploaderName || uploader?.email || "A team member"} uploaded ${parsed.vendorName || "a receipt"} (INR ${parsed.amount.toFixed(2)}).`;
      const notificationMessage =
        reasonsList.length > 0
          ? `${baseMessage} ${reasonsList.join(", ")}.`
          : `${baseMessage} Ready for approval workflow.`;

      for (const manager of managersAndAdmins) {
        await sendNotification({
          tenantId: authContext!.tenantId,
          userId: manager.id,
          channel: "in_app",
          title: notificationTitle,
          message: notificationMessage,
          relatedType: "receipt",
          relatedId: createdReceipt.id,
        });
      }

      logger.info("Receipt upload notifications sent to approvers", {
        requestId,
        route: "/api/receipts/upload",
        receiptId: createdReceipt.id,
        notificationCount: managersAndAdmins.length,
        status: createdReceipt.status,
      });
    } catch (notificationError) {
      logger.error("Failed to send approver upload notifications", {
        requestId,
        route: "/api/receipts/upload",
        receiptId: createdReceipt.id,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
      // Don't fail the upload if notifications fail
    }

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
