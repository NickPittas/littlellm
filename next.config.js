/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable to prevent double renders in development
  experimental: {
    typedRoutes: true,
    // optimizeCss: true, // Disabled due to critters dependency issue
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'], // Tree shake icon libraries
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
  // Enable compression
  compress: true,
  // Optimize fonts
  optimizeFonts: true,
  // Enable SWC minification for better performance
  swcMinify: true,
  // Security headers (only in development/server mode, not for static export)
  ...(process.env.NODE_ENV !== 'production' && {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            // Content Security Policy - Secure but allows local AI providers
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed for dynamic imports, unsafe-inline for Next.js
                "style-src 'self' 'unsafe-inline' data:", // unsafe-inline needed for styled-components and CSS-in-JS
                "img-src 'self' data: blob: https:",
                "font-src 'self' data:",
                // Allow connections to local AI providers and external APIs
                "connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:* http://0.0.0.0:*",
                "media-src 'self' blob:",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'"
                // Removed upgrade-insecure-requests to allow local HTTP connections
              ].join('; ')
            },
            // Prevent clickjacking
            {
              key: 'X-Frame-Options',
              value: 'DENY'
            },
            // Prevent MIME type sniffing
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff'
            },
            // Enable XSS protection
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block'
            },
            // Referrer policy
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin'
            },
            // Permissions policy
            {
              key: 'Permissions-Policy',
              value: [
                'camera=()',
                'microphone=()',
                'geolocation=()',
                'interest-cohort=()'
              ].join(', ')
            },
            // Strict Transport Security (HTTPS only)
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload'
            },
            // Cross-Origin policies
            {
              key: 'Cross-Origin-Embedder-Policy',
              value: 'require-corp'
            },
            {
              key: 'Cross-Origin-Opener-Policy',
              value: 'same-origin'
            },
            {
              key: 'Cross-Origin-Resource-Policy',
              value: 'same-origin'
            }
          ]
        }
      ];
    }
  }),
  // Fix webpack caching issues on Windows and basic optimization
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = false;
    }

    // Basic optimization for production
    if (!dev && !isServer) {
      // Enable tree shaking
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
      };

      // Basic alias optimization
      config.resolve = config.resolve || {};
      config.resolve.alias = config.resolve.alias || {};
      config.resolve.alias['moment/locale'] = false;
    }

    return config;
  },
  // Only use export mode when building for production
  ...(process.env.NODE_ENV === 'production' && {
    output: 'export',
    trailingSlash: true,
    distDir: 'out',
  }),
}

export default nextConfig;