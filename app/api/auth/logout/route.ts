import { NextResponse } from "next/server";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import {
  normalizeRootDomain,
  getCookieDomainForHostname,
} from "@/lib/utils/tenant-host";

/**
 * Build the post-logout redirect target.
 *
 * Rules:
 * - Only allow same-origin redirects — prevents open-redirect and stops
 *   local dev from bouncing to spendly.software.
 * - Default destination is "/" (marketing home), NOT "/login".
 *   Login only appears when the user tries to access a protected route.
 */
function buildRedirectTarget(request: Request): URL {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next");

  if (nextParam) {
    try {
      const target = new URL(nextParam, url.origin);
      // Only allow same-origin redirects
      if (target.origin === url.origin) {
        return target;
      }
    } catch {
      // Invalid URL — fall through to default
    }
  }

  // Default: marketing home on the same origin
  return new URL("/", url.origin);
}

function clearSessionCookies(request: Request, response: NextResponse) {
  const expiredCookieOptions = createAuthCookieOptions(request, 0);

  // Always clear host-only cookies (no domain attribute)
  const hostOnlyOpts = { ...expiredCookieOptions } as any;
  delete hostOnlyOpts.domain;
  response.cookies.set("accessToken", "", hostOnlyOpts);
  response.cookies.set("refreshToken", "", hostOnlyOpts);

  // Also clear domain-scoped cookies (root domain) if applicable
  try {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();
    const root = normalizeRootDomain(
      process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    );
    const cookieDomain = getCookieDomainForHostname(
      hostname,
      root ?? undefined,
    );

    if (cookieDomain) {
      const domainOpts = {
        ...expiredCookieOptions,
        domain: cookieDomain,
      } as any;
      response.cookies.set("accessToken", "", domainOpts);
      response.cookies.set("refreshToken", "", domainOpts);
    }
  } catch {
    // ignore URL parse errors and rely on host-only clear above
  }
}

export async function GET(request: Request) {
  const response = NextResponse.redirect(buildRedirectTarget(request));
  clearSessionCookies(request, response);
  return response;
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true, message: "Logged out." });
  clearSessionCookies(request, response);
  return response;
}
