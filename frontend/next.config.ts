import type { NextConfig } from "next";
import dotenv from "dotenv";

dotenv.config();

const normalizeAllowedDevOrigin = (origin: string): string | undefined => {
  const trimmed = origin.trim();
  if (!trimmed || trimmed === "*" || trimmed === "**") {
    return undefined;
  }

  try {
    const url = trimmed.includes("://") ? trimmed : `http://${trimmed}`;
    return new URL(url).origin;
  } catch {
    return trimmed;
  }
};

const isString = (value: string | undefined): value is string =>
  typeof value === "string" && value.length > 0;

const allowedDevOriginsSource = process.env.ALLOWED_DEV_ORIGINS || process.env.ALLOWED_ORIGINS;

let allowedDevOrigins: string[] = ['10.166.85.53', 'localhost:3000', '127.0.0.1:3000'];
if (allowedDevOriginsSource) {
  const parsed = allowedDevOriginsSource
    .split(",")
    .map(normalizeAllowedDevOrigin)
    .filter(isString);
  allowedDevOrigins = [...allowedDevOrigins, ...parsed];
}

const nextConfig: NextConfig = {
  reactCompiler: false,
  allowedDevOrigins,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:5001';
    return [
      {
        source: '/api/automation/:path*',
        destination: `${backendUrl}/api/v1/automation/:path*`,
      },
      {
        source: '/api/campaign/:path*',
        destination: `${backendUrl}/api/v1/campaign/:path*`,
      },
      {
        source: '/api/whatsapp-forms/:path*',
        destination: `${backendUrl}/api/v1/automation/engine/whatsapp-forms/:path*`,
      },
      {
        source: '/api/whatsapp-forms',
        destination: `${backendUrl}/api/v1/automation/engine/whatsapp-forms`,
      },
      {
        source: '/api/campaigns/:path*',
        destination: `${backendUrl}/api/v1/campaign/campaigns/:path*`,
      },
      {
        source: '/api/campaigns',
        destination: `${backendUrl}/api/v1/campaign/campaigns`,
      },
      {
        source: '/api/segments/:path*',
        destination: `${backendUrl}/api/v1/campaign/segments/:path*`,
      },
      {
        source: '/api/segments',
        destination: `${backendUrl}/api/v1/campaign/segments`,
      },
      {
        source: '/api/workspace/:path*',
        destination: `${backendUrl}/api/v1/workspace/:path*`,
      },
      {
        source: '/api/billing/:path*',
        destination: `${backendUrl}/api/v1/billing/:path*`,
      },
      {
        source: '/api/admin/:path*',
        destination: `${backendUrl}/api/v1/super-admin/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
