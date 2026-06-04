import { NextResponse } from "next/server";
import crypto from "crypto";
import { requestOtpSchema } from "@/lib/validators/auth";
import { createEmailOtpChallenge } from "@/lib/repositories/authChallengeRepository";
import { sendEmail } from "@/lib/utils/mailer";
import { getEmailBranding } from "@/lib/utils/email-branding";
import logger from "@/lib/utils/logger";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const body = await request.json();
    const payload = requestOtpSchema.parse(body);

    let otp: string;
    try {
      const result = await createEmailOtpChallenge({
        email: payload.email,
        purpose: "signup",
        ttlMinutes: 10,
        minIntervalSeconds: 60,
      });
      otp = result.otp;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (typeof msg === "string" && msg.startsWith("COOLDOWN:")) {
        const parts = msg.split(":");
        const retryAfter = Number(parts[1] || 60);
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "TOO_MANY_REQUESTS",
              message: `Please wait ${retryAfter} seconds before requesting another OTP.`,
              retryAfter,
            },
            requestId,
          },
          { status: 429, headers: { "Retry-After": String(retryAfter) } },
        );
      }

      throw err;
    }

    const branding = getEmailBranding(request.url);

    await sendEmail({
      to: payload.email,
      subject: "Your Spendly signup verification code",
      templateName: "signup-otp",
      templateData: {
        otp,
        expiryMinutes: 10,
        appName: branding.appName,
        supportEmail: branding.supportEmail,
        logoUrl: branding.logoUrl,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "OTP sent to your email.",
        requestId,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send OTP.";

    logger.error("Signup OTP request failed", {
      requestId,
      route: "/api/auth/signup/otp",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "OTP_SEND_FAILED",
          message,
          requestId,
        },
      },
      { status: 400 },
    );
  }
}
