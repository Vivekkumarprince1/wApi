import type { NextConfig } from "next";
import dotenv from "dotenv";

dotenv.config();

const nextConfig: NextConfig = {
  reactCompiler: false,
  experimental: {
    webpackMemoryOptimizations: true,
  },
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",")
    : undefined,
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
