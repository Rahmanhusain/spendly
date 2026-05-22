const DEFAULT_APP_NAME = "Spendly";
const DEFAULT_SUPPORT_EMAIL = "support@example.com";

function resolveBaseUrl(baseUrl?: string) {
  return (
    baseUrl ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  );
}

export function getEmailBranding(baseUrl?: string) {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);

  return {
    appName: process.env.APP_NAME || DEFAULT_APP_NAME,
    supportEmail: process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL,
    logoUrl: new URL("/logo/logo.png", resolvedBaseUrl).toString(),
  };
}
