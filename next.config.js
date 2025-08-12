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
  // Security headers (only in development/server mode, not for static export)
  ...(process.env.NODE_ENV !== 'production' && {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            // Content Security Policy
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed for dynamic imports, unsafe-inline for Next.js
                "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for styled-components and CSS-in-JS
                "img-src 'self' data: blob: https:",
                "font-src 'self' data:",
                "connect-src 'self' https: wss: ws:",
                "media-src 'self' blob:",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "upgrade-insecure-requests"
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
  // Fix webpack caching issues on Windows and optimize bundle splitting
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = false;
    }

    // Optimize bundle splitting for production
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            // Separate vendor chunks for heavy libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              maxSize: 100000, // 100kB limit for vendor chunks
              priority: 10,
            },
            // Separate chunk for PDF processing
            pdf: {
              test: /[\\/]node_modules[\\/](pdfjs-dist|pdf2pic)[\\/]/,
              name: 'pdf-processing',
              chunks: 'all',
              priority: 20,
            },
            // Separate chunk for document processing
            documents: {
              test: /[\\/]node_modules[\\/](mammoth|xlsx|csv-parser)[\\/]/,
              name: 'document-processing',
              chunks: 'all',
              priority: 20,
            },
            // Separate chunk for syntax highlighting
            syntax: {
              test: /[\\/]node_modules[\\/](react-syntax-highlighter)[\\/]/,
              name: 'syntax-highlighting',
              chunks: 'all',
              priority: 20,
            },
            // Separate chunk for transformers
            transformers: {
              test: /[\\/]node_modules[\\/](@xenova\/transformers)[\\/]/,
              name: 'transformers',
              chunks: 'all',
              priority: 20,
            },
            // UI components chunk
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
              name: 'ui-components',
              chunks: 'all',
              priority: 15,
            },
          },
        },
      };
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