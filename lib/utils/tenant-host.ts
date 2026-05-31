const LOCALHOST = "localhost";
const VERCEL_APP_SUFFIX = ".vercel.app";

type TenantRoutingMode = "subdomain" | "path";

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//, "");
}

function stripPathAndPort(value: string): string {
  return value.split("/")[0].split(":")[0];
}

export function normalizeRootDomain(rootDomain?: string): string | null {
  if (!rootDomain) {
    return null;
  }

  const normalized = stripPathAndPort(stripProtocol(rootDomain.trim()))
    .replace(/^\.+/, "")
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

function isLocalhostFamily(hostname: string): boolean {
  return hostname === LOCALHOST || hostname.endsWith(`.${LOCALHOST}`);
}

function isVercelAppHostname(hostname: string): boolean {
  return hostname === "vercel.app" || hostname.endsWith(VERCEL_APP_SUFFIX);
}

function isIpv4(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function deriveBaseDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);

  if (parts.length <= 2) {
    return hostname.toLowerCase();
  }

  return parts.slice(1).join(".");
}

function resolveTenantRoutingMode(hostname?: string): TenantRoutingMode {
  const raw =
    process.env.TENANT_ROUTING_MODE ||
    process.env.NEXT_PUBLIC_TENANT_ROUTING_MODE;

  if (!raw) {
    if (hostname && isLocalhostFamily(hostname.toLowerCase())) {
      return "path";
    }

    return "subdomain";
  }

  const normalized = raw.trim().toLowerCase();
  return normalized === "path" ? "path" : "subdomain";
}

export function getCookieDomainForHostname(
  hostname: string,
  rootDomain?: string,
): string | undefined {
  const normalizedHost = hostname.toLowerCase();
  const normalizedRoot = normalizeRootDomain(rootDomain);

  if (isLocalhostFamily(normalizedHost)) {
    return undefined;
  }

  // Vercel preview/default domains should use host-only cookies.
  if (isVercelAppHostname(normalizedHost)) {
    return undefined;
  }

  if (isIpv4(normalizedHost)) {
    return undefined;
  }

  if (normalizedRoot) {
    return normalizedRoot;
  }

  return deriveBaseDomain(normalizedHost);
}

export function buildTenantWorkspaceUrl(
  tenantSlug: string,
  currentUrl: string,
  rootDomain?: string,
): string {
  const url = new URL(currentUrl);
  const hostname = url.hostname.toLowerCase();
  const port = url.port;
  const normalizedRoot = normalizeRootDomain(rootDomain);
  const slug = tenantSlug.toLowerCase();
  const routingMode = resolveTenantRoutingMode(hostname);

  if (routingMode === "path") {
    const host = isLocalhostFamily(hostname) ? LOCALHOST : hostname;
    const hostWithPort = port ? `${host}:${port}` : host;
    return `${url.protocol}//${hostWithPort}/workspace`;
  }

  let targetHost: string;

  if (isLocalhostFamily(hostname)) {
    targetHost = `${slug}.localhost`;
  } else if (isVercelAppHostname(hostname)) {
    // On default/preview Vercel hosts, keep same host and route by path.
    targetHost = hostname;
  } else {
    const baseDomain = normalizedRoot ?? deriveBaseDomain(hostname);
    targetHost = `${slug}.${baseDomain}`;
  }

  const hostWithPort = port ? `${targetHost}:${port}` : targetHost;

  return `${url.protocol}//${hostWithPort}/workspace`;
}
