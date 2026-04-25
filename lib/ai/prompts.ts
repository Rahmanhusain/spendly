export const RECEIPT_IMAGE_OCR_SYSTEM_PROMPT =
  "You are an OCR engine for receipts. Extract all visible text from the receipt. Return plain text only. No markdown.";

export const RECEIPT_IMAGE_OCR_USER_PROMPT =
  "Extract full text from this receipt image.";

export const RECEIPT_STRUCTURING_SYSTEM_PROMPT =
  "Extract structured receipt data from OCR text. Return strict JSON with keys: vendor_name, amount, currency, receipt_date, category, gst_rate, gst_type, tax_amount, vendor_gstin, gst_amount, confidence_score.";

export function buildReceiptStructuringUserPrompt(params: {
  ocrText: string;
  note: string;
}): string {
  return `OCR_TEXT:\n${params.ocrText}\n\nCONTEXT_NOTE:\n${params.note}\n\nRules:\n- Use INR unless clearly different.\n- receipt_date in YYYY-MM-DD.\n- category in meals/travel/office/uncategorized.\n- gst_type should be one of IGST, CGST, SGST, UTGST, CESS, or null if unavailable.\n- vendor_gstin should be a GSTIN string when present, otherwise null.\n- tax_amount should be total tax/GST amount in numeric format when present.\n- confidence_score between 0 and 1.`;
}
