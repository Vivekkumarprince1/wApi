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

const allowedDevOrigins = allowedDevOriginsSource
  ? allowedDevOriginsSource
    .split(",")
    .map(normalizeAllowedDevOrigin)
    .filter(isString)
  : undefined;

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins,
  experimental: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/automation/:path*',
        destination: '/api/automation',
      },
      {
        source: '/api/whatsapp-forms/:path*',
        destination: '/api/automation/whatsapp-forms/:path*',
      },
      {
        source: '/api/whatsapp-forms',
        destination: '/api/automation/whatsapp-forms',
      },
      {
        source: '/api/campaign-proxy/:path*',
        destination: '/api/campaign-proxy',
      },
      {
        source: '/api/campaigns/:path*',
        destination: '/api/campaign-proxy/campaigns/:path*',
      },
      {
        source: '/api/campaigns',
        destination: '/api/campaign-proxy/campaigns',
      },
      {
        source: '/api/segments/:path*',
        destination: '/api/campaign-proxy/segments/:path*',
      },
      {
        source: '/api/segments',
        destination: '/api/campaign-proxy/segments',
      },
    ];
  },
};

export default nextConfig;
