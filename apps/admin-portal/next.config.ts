import type { NextConfig } from "next";
import webpack from "webpack";

// Optional native/cloud deps that `mongodb` lazily requires (kerberos, AWS/GCP
// auth, compression). They are not installed and not needed for our usage, but
// because @connectsphere/contracts is transpiled, webpack tries to resolve them and warns.
// Ignore them at the bundler level so the build is clean.
const MONGODB_OPTIONAL_DEPS = [
  "aws4",
  "kerberos",
  "@mongodb-js/zstd",
  "@aws-sdk/credential-providers",
  "gcp-metadata",
  "snappy",
  "socks",
  "mongodb-client-encryption",
];

/**
 * Admin Portal — standalone Next.js fullstack app (admin.connectsphere.in).
 *
 * Unlike the customer portal, this app does NOT rewrite /api/* to the
 * gateway. All admin traffic is handled by local route handlers under
 * /api/admin/*:
 *   - reads  -> direct MongoDB (src/server/db.ts + src/server/db-models)
 *   - writes -> API Gateway (src/server/gateway-client.ts)
 */
const nextConfig: NextConfig = {
  reactCompiler: false,
  transpilePackages: ["@connectsphere/contracts"],
  experimental: {
    externalDir: true,
    webpackMemoryOptimizations: true,
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  // Keep these out of the bundle so their optional native deps (aws4,
  // kerberos, @mongodb-js/zstd, …) are required at runtime, not webpack-bundled.
  // `mongodb` is pulled in transitively via @connectsphere/contracts/dist/models.js.
  serverExternalPackages: ["mongoose", "mongodb", "bcryptjs", "bullmq", "ioredis"],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",")
    : undefined,
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: new RegExp(
            `^(${MONGODB_OPTIONAL_DEPS.map((d) => d.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})$`
          ),
        })
      );
    }
    return config;
  },
};

export default nextConfig;
