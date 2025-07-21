/** @type {import('next').NextConfig} */
const { IgnorePlugin } = require('webpack');

const nextConfig = {
  webpack: (config, { isServer, dev }) => {
    // Add a rule to handle .node files
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    // Handle externals properly for both client and server
    const originalExternals = config.externals || [];
    
    config.externals = ({ context, request }, callback) => {
      // Externalize native modules to prevent bundling
      if (['vectordb', '@lancedb/vectordb-win32-x64-msvc', 'pdf-parse', 'onnxruntime-node', 'onnxruntime', 'sharp'].includes(request)) {
        return callback(null, `commonjs ${request}`);
      }
      
      // Handle original externals
      if (typeof originalExternals === 'function') {
        return originalExternals({ context, request }, callback);
      } else if (Array.isArray(originalExternals)) {
        if (originalExternals.includes(request)) {
          return callback(null, `commonjs ${request}`);
        }
      }
      
      // Default behavior
      callback();
    };

    // Ignore the dynamic require in lancedb that webpack can't handle
    config.plugins.push(
      new IgnorePlugin({
        resourceRegExp: /^\.\//,
        contextRegExp: /vectordb/,
      })
    );

    // Ignore Node.js modules in client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        buffer: false,
        util: false,
        url: false,
        querystring: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    return config;
  },
  // Configuration optimized for Electron development - DISABLE SSR COMPLETELY
  distDir: '.next',
  images: {
    unoptimized: true
  },
  // Configuration for Electron development
  trailingSlash: false,
  experimental: {
    typedRoutes: true,
  },
  reactStrictMode: false, // Disable to prevent double renders in development
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;