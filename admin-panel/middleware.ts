// No middleware needed — auth is handled server-side in app/(protected)/layout.tsx
// This file exists to prevent Next.js from resolving middleware from a parent directory.
export function middleware() {}

export const config = {
  matcher: [],
};
