import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      bodySizeLimit: "30mb"
    }
  },
  serverExternalPackages: ["@prisma/client"]
};

export default nextConfig;
