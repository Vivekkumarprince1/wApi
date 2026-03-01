/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,

  // Remove console.log in production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // Tree-shake icon libraries — import only the icons used, not entire bundles
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
    'react-icons/fa': {
      transform: 'react-icons/fa/index.esm.js',
    },
  },

  images: {
    domains: [],
    remotePatterns: [],
    formats: ['image/avif', 'image/webp'],
  },

  // Enable gzip compression
  compress: true,

  // Reduce dev indicator noise
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right',
  },
}

module.exports = nextConfig