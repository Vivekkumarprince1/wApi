import type { NextConfig } from "next";

/**
 * Admin Portal — standalone Next.js fullstack app (admin.wapi.in).
 *
 * Unlike the customer portal, this app does NOT rewrite /api/* to the
 * gateway. All admin traffic is handled by local route handlers under
 * /api/admin/*:
 *   - reads  -> direct MongoDB (src/server/db.ts + src/server/db-models)
 *   - writes -> API Gateway (src/server/gateway-client.ts)
 */
const nextConfig: NextConfig = {
  reactCompiler: false,
  transpilePackages: ["@wapi/contracts"],
  experimental: {
    externalDir: true,
    webpackMemoryOptimizations: true,
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  // Mongoose + native deps must run in the Node server runtime, never bundled
  // for the edge or client.
  serverExternalPackages: ["mongoose", "bcryptjs", "bullmq", "ioredis"],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",")
    : undefined,
};

export default nextConfig;
