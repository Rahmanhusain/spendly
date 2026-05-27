import { NextResponse } from "next/server";
import { upsertInboundEmail } from "@/lib/repositories/adminRepository";
import logger from "@/lib/utils/logger";
import { Webhook } from "svix";

/**
 * Resend inbound email webhook.
 * Configure in Resend dashboard: Webhooks → Add endpoint → select "email.received"
 * Endpoint URL: https://admin.spendly.software/api/webhooks/resend
 *
 * Resend signs requests with the webhook signing secret from the dashboard.
 */
export async function POST(request: Request) {
  const requestId = `wh_${crypto.randomUUID()}`;

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

    await upsertInboundEmail({
      resend_email_id: data?.email_id ?? data?.id ?? undefined,
      direction: "inbound",
      from_address: data?.from ?? data?.sender ?? "",
      to_address: Array.isArray(data?.to)
        ? data.to.join(", ")
        : (data?.to ?? ""),
      subject: data?.subject ?? "(no subject)",
      text_body: data?.text ?? data?.plain_text ?? undefined,
      html_body: data?.html ?? undefined,
      raw_payload: payload,
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
