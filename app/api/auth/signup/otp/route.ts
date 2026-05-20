import { NextResponse } from "next/server";
import crypto from "crypto";
import { requestOtpSchema } from "@/lib/validators/auth";
import { query } from "@/lib/db/client";
import { createEmailOtpChallenge } from "@/lib/repositories/authChallengeRepository";
import { sendEmail } from "@/lib/utils/mailer";
import logger from "@/lib/utils/logger";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const body = await request.json();
    const payload = requestOtpSchema.parse(body);

    const existingUser = await query<{ id: string }>(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      [payload.email.toLowerCase()],
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "EMAIL_IN_USE",
            message: "An account with this email already exists.",
            requestId,
          },
        },
        { status: 409 },
      );
    }

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

    await sendEmail({
      to: payload.email,
      subject: "Your Spendly signup verification code",
      templateName: "signup-otp",
      templateData: {
        otp,
        expiryMinutes: 10,
        appName: process.env.APP_NAME ?? "Spendly",
        supportEmail:
          process.env.SUPPORT_EMAIL ??
          process.env.RESEND_FROM_EMAIL ??
          "support@example.com",
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
