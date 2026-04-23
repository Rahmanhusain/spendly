import { getCookieDomainForHostname } from "@/lib/utils/tenant-host";

export function getRequestHostname(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const primaryForwardedHost = forwardedHost?.split(",")[0]?.trim();
  const host =
    primaryForwardedHost || request.headers.get("host") || "localhost";
  return host.split(":")[0].toLowerCase();
}

export function createAuthCookieOptions(request: Request, maxAge: number) {
  const hostname = getRequestHostname(request);
  const cookieDomain = getCookieDomainForHostname(
    hostname,
    process.env.ROOT_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  );

  console.info("[AuthCookies] Creating cookie options", {
    hostname,
    maxAge,
    cookieDomain: cookieDomain ?? "host-only",
  });

  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}
