import { NextResponse } from "next/server";
import crypto from "crypto";
import { extractAuthContext, requireAuth } from "@/lib/middleware/auth";
import { query } from "@/lib/db/client";
import { createEmailOtpChallenge } from "@/lib/repositories/authChallengeRepository";
import { sendEmail } from "@/lib/utils/mailer";
import { getEmailBranding } from "@/lib/utils/email-branding";
import logger from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const authContext = await extractAuthContext(request, requestId);
    requireAuth(authContext);

    const userResult = await query<{ email: string }>(
      `SELECT email FROM users WHERE id = $1 AND status = 'active' LIMIT 1`,
      [authContext!.userId],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: { message: "User not found." } },
        { status: 404 },
      );
    }

    const branding = getEmailBranding(request.url);
    const email = userResult.rows[0].email.toLowerCase();

    let otp: string;
    try {
      const result = await createEmailOtpChallenge({
        email,
        purpose: "password_change",
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
      to: email,
      subject: "Your Spendly password change code",
      templateName: "password-change-otp",
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

    logger.error("Password change OTP request failed", {
      requestId,
      route: "/api/users/password/otp",
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
