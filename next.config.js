/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable to prevent double renders in development
  experimental: {
    typedRoutes: true,
  },
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig