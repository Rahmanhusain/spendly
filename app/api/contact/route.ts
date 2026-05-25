import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { contactSchema } from "@/lib/validators/contact";
import { sendEmail } from "@/lib/utils/mailer";
import logger from "@/lib/utils/logger";
import crypto from "crypto";

const SUPPORT_EMAIL = "support@spendly.software";
const APP_NAME = "Spendly";

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
    const feedbackFrom =
      process.env.RESEND_FEEDBACK_FROM_EMAIL ||
      `${APP_NAME} Feedback <feedback@spendly.software>`;

    const templateData = {
      appName: APP_NAME,
      reasonLabel,
      senderName: payload.name,
      senderEmail: payload.email,
      subject: payload.subject,
      message: payload.message,
      supportEmail: SUPPORT_EMAIL,
    };

    // 1. Notify support inbox
    await sendEmail({
      to: SUPPORT_EMAIL,
      from: feedbackFrom,
      subject: `[${reasonLabel}] ${payload.subject}`,
      templateName: "contact-submission",
      templateData,
    });

    // 2. Confirm receipt to the sender
    await sendEmail({
      to: payload.email,
      from: SUPPORT_EMAIL,
      subject: `We received your message — ${APP_NAME}`,
      templateName: "contact-confirmation",
      templateData,
    });

    logger.info("Contact form emails sent", {
      requestId,
      route: "/api/contact",
      reason: payload.reason,
      senderEmail: payload.email,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.errors.map((e) => e.message).join(", ");
      logger.warn("Contact form validation failed", {
        requestId,
        route: "/api/contact",
        message,
      });
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION_ERROR", message } },
        { status: 422 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to send message.";
    logger.error("Contact form submission failed", {
      requestId,
      route: "/api/contact",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      { ok: false, error: { code: "SEND_ERROR", message } },
      { status: 500 }
    );
  }
}
