import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Scope file tracing and module resolution to this subdirectory only.
  // This prevents Next.js from picking up the root proxy.ts and other
  // files from the parent monorepo.
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
