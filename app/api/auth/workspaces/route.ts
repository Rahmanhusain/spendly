import { NextResponse } from "next/server";
import crypto from "crypto";
import { requestOtpSchema } from "@/lib/validators/auth";
import { getWorkspacesByEmail } from "@/lib/repositories/authRepository";
import logger from "@/lib/utils/logger";

export async function GET(request: Request) {
  const requestId = `req_${crypto.randomUUID()}`;

  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email");

    const parsed = requestOtpSchema.safeParse({ email });
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "INVALID_EMAIL",
            message:
              parsed.error.issues[0]?.message ?? "Enter a valid email address.",
            requestId,
          },
        },
        { status: 400 },
      );
    }

    const workspaces = await getWorkspacesByEmail(parsed.data.email);

    return NextResponse.json(
      {
        ok: true,
        data: { workspaces },
        requestId,
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load workspaces.";
    logger.error("Workspace lookup failed", {
      requestId,
      route: "/api/auth/workspaces",
      message,
      error: error instanceof Error ? error.stack : String(error),
    });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "WORKSPACE_LOOKUP_FAILED",
          message,
          requestId,
        },
      },
      { status: 400 },
    );
  }
}
