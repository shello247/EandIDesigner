import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "30mb"
    }
  },
  webpack(config) {
    // Guarded synthetic qualification must not reuse a cache written by the
    // shared development runtime or a previous dependency installation.
    if (process.env.EI_SYNTHETIC_PREVIEW === "true") config.cache = false;
    return config;
  },
  serverExternalPackages: ["@prisma/client"]
};

export default nextConfig;
