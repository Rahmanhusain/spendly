import { redirect } from "next/navigation";

// ─── App route constants ──────────────────────────────────────────────────────
// Change a path here and every redirect across the app updates automatically.

export const ROUTES = {
  home: "/",
  login: "/login",
  signUp: "/sign-up",
  workspace: "/workspace",
} as const;

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
