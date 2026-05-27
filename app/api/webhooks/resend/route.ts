import { NextResponse } from "next/server";
import { upsertInboundEmail } from "@/lib/repositories/adminRepository";
import logger from "@/lib/utils/logger";
import { Webhook } from "svix";
import { Resend } from "resend";

function stripQuotedTextBody(body: string): string {
  const normalizedBody = body.replace(/\r\n/g, "\n").trim();
  const replyMarkers = [
    /^On .+wrote:$/m,
    /^-----Original Message-----$/m,
    /^_{5,}$/m,
  ];

  let cutIndex = normalizedBody.length;

  for (const marker of replyMarkers) {
    const match = normalizedBody.match(marker);
    if (match?.index !== undefined) {
      cutIndex = Math.min(cutIndex, match.index);
    }
  }

  return normalizedBody.slice(0, cutIndex).trim();
}

function stripQuotedHtmlBody(body: string): string {
  const blockquoteIndex = body.search(/<blockquote\b/i);
  const gmailQuoteIndex = body.search(/class="[^"]*gmail_quote[^"]*"/i);
  const cutIndex =
    blockquoteIndex >= 0 && gmailQuoteIndex >= 0
      ? Math.min(blockquoteIndex, gmailQuoteIndex)
      : Math.max(blockquoteIndex, gmailQuoteIndex);

  if (cutIndex >= 0) {
    return body.slice(0, cutIndex).trim();
  }

  return body.trim();
}

/**
 * Resend inbound email webhook.
 * Configure in Resend dashboard: Webhooks → Add endpoint → select "email.received"
 * Endpoint URL: https://admin.spendly.software/api/webhooks/resend
 *
 * Resend signs requests with the webhook signing secret from the dashboard.
 */
export async function POST(request: Request) {
  const requestId = `wh_${crypto.randomUUID()}`;
  const resendApiKey =
    process.env.RESEND_RECEIVING_API_KEY ?? process.env.RESEND_API_KEY;
  const resend = resendApiKey ? new Resend(resendApiKey) : null;

  try {
    const rawBody = await request.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (webhookSecret) {
      const headers = {
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      };

      try {
        new Webhook(webhookSecret).verify(rawBody, headers);
      } catch {
        logger.warn("Resend webhook signature mismatch", { requestId });
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 },
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    // Only handle inbound email events
    if (type !== "email.received" && type !== "inbound.email") {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const emailId = data?.email_id ?? data?.id;
    let fullEmail = null;

    if (emailId && resend) {
      const { data: receivedEmail, error } =
        await resend.emails.receiving.get(emailId);

      if (error) {
        const errorName =
          typeof error === "object" && error && "name" in error
            ? String((error as { name?: unknown }).name)
            : "unknown_error";

        logger.warn("Failed to fetch full received email", {
          requestId,
          emailId,
          errorName,
          error,
        });

        if (errorName === "restricted_api_key") {
          logger.warn(
            "Set RESEND_RECEIVING_API_KEY to a Resend full-access key so inbound email content can be fetched",
            { requestId, emailId },
          );
        }
      } else {
        fullEmail = receivedEmail;
      }
    }

    const fullText = fullEmail?.text ?? data?.text ?? data?.plain_text ?? null;
    const fullHtml = fullEmail?.html ?? data?.html ?? null;
    const trimmedText = fullText ? stripQuotedTextBody(fullText) : null;
    const trimmedHtml = fullHtml ? stripQuotedHtmlBody(fullHtml) : null;
    const senderAddress = fullEmail?.from ?? data?.from ?? data?.sender ?? "";
    const recipientAddress = Array.isArray(fullEmail?.to)
      ? fullEmail.to.join(", ")
      : Array.isArray(data?.to)
        ? data.to.join(", ")
        : (data?.to ?? "");

    await upsertInboundEmail({
      resend_email_id: emailId ?? undefined,
      direction: "inbound",
      from_address: senderAddress,
      to_address: recipientAddress,
      subject: data?.subject ?? "(no subject)",
      text_body: trimmedText ?? undefined,
      html_body: trimmedHtml ?? undefined,
      raw_payload: {
        webhook: payload,
        received_email: fullEmail,
      },
    });

    logger.info("Inbound email stored via webhook", { requestId, type });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error("Resend webhook processing failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
