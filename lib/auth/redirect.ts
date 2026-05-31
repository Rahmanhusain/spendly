import { redirect } from "next/navigation";

// ─── App route constants ──────────────────────────────────────────────────────
// Change a path here and every redirect across the app updates automatically.

export const ROUTES = {
  home: "/",
  login: "/login",
  signUp: "/sign-up",
  workspace: "/workspace",
} as const;

export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "https://spendly.software";

// ─── Redirect helpers ─────────────────────────────────────────────────────────

/**
 * Redirect an unauthenticated user to the login page.
 * Use this in server components / layouts when `authContext` is null.
 */
export function redirectToLogin(): never {
  redirect(ROUTES.login);
}

/**
 * Redirect an already-authenticated user away from auth pages (login, sign-up).
 */
export function redirectToWorkspace(): never {
  redirect(ROUTES.workspace);
}

/**
 * Redirect to the public home page.
 */
export function redirectToHome(): never {
  redirect(ROUTES.home);
}

/**
 * Redirect through the logout endpoint so auth cookies are cleared first.
 */
export function redirectToLogout(nextPath: string = PUBLIC_SITE_URL): never {
  redirect(`/api/auth/logout?next=${encodeURIComponent(nextPath)}`);
}
