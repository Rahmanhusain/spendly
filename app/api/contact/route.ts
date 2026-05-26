import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { contactSchema } from "@/lib/validators/contact";
import { createContactInquiry } from "@/lib/repositories/adminRepository";
import { sendEmail } from "@/lib/utils/mailer";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

const APP_NAME = "Spendly";
const SUPPORT_EMAIL = "support@spendly.software";

const reasonLabels: Record<string, string> = {
  complaint: "Complaint",
  suggestion: "Suggestion",
  feedback: "Feedback",
  query: "General Query",
  support: "Product Support",
  partnership: "Partnership",
};

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;
  logger.info("Contact form submission started", {
    requestId,
    route: "/api/contact",
  });

  try {
    const body = await request.json();
    const payload = contactSchema.parse(body);
    const reasonLabel = reasonLabels[payload.reason] ?? payload.reason;

    // Save inquiry to database
    const inquiry = await createContactInquiry({
      sender_name: payload.name,
      sender_email: payload.email,
      reason: payload.reason,
      subject: payload.subject,
      message: payload.message,
    });

    // Send confirmation email to the user only
    await sendEmail({
      to: payload.email,
      from : `Spendly <${SUPPORT_EMAIL}>`,
      subject: `We received your message — ${APP_NAME}`,
      templateName: "contact-confirmation",
      templateData: {
        appName: APP_NAME,
        reasonLabel,
        senderName: payload.name,
        senderEmail: payload.email,
        subject: payload.subject,
        message: payload.message,
        supportEmail: SUPPORT_EMAIL,
      },
    });

    logger.info("Contact inquiry saved and confirmation sent", {
      requestId,
      route: "/api/contact",
      inquiryId: inquiry.id,
      reason: payload.reason,
      senderEmail: payload.email,
    });

    return NextResponse.json({ ok: true, inquiryId: inquiry.id }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.errors.map((e) => e.message).join(", ");
      logger.warn("Contact form validation failed", { requestId, message });
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message } },
        { status: 422 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to submit inquiry.";
    logger.error("Contact form submission failed", {
      requestId,
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      { ok: false, error: { code: "SUBMIT_ERROR", message } },
      { status: 500 }
    );
  }
}
