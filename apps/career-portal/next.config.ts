import type { NextConfig } from "next";
import { join } from "node:path";

const nextConfig: NextConfig = {
  reactCompiler: false,
  outputFileTracingRoot: join(process.cwd(), "../.."),
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
