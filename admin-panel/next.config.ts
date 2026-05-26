import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const adminPanelRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: adminPanelRoot,
  },
};

export default nextConfig;
