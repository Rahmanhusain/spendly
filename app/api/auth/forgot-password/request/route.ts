import { NextResponse } from "next/server";
import crypto from "crypto";
import { requestOtpSchema } from "@/lib/validators/auth";
import { query } from "@/lib/db/client";
import { createEmailOtpChallenge } from "@/lib/repositories/authChallengeRepository";
import { sendEmail } from "@/lib/utils/mailer";
import { getEmailBranding } from "@/lib/utils/email-branding";
import logger from "@/lib/utils/logger";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const body = await request.json();
    const payload = requestOtpSchema.parse(body);

    const userResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 AND status = 'active' LIMIT 1`,
      [payload.email.toLowerCase()],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "ACCOUNT_NOT_FOUND",
            message: "No active account exists for this email.",
          },
          requestId,
        },
        { status: 404 },
      );
    }

    let otp: string;
    try {
      const result = await createEmailOtpChallenge({
        email: payload.email,
        purpose: "password_reset",
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
      subject: "Your Spendly password reset code",
      templateName: "forgot-password-otp",
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
        message: "If this email exists, an OTP has been sent.",
        requestId,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send reset OTP.";

    logger.error("Forgot password OTP request failed", {
      requestId,
      route: "/api/auth/forgot-password/request",
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
