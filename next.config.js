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
  // Fix webpack caching issues on Windows
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.cache = false;
    }
    
    // Handle Node.js modules in client-side builds (only add minimal config needed)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        path: false,
      };
      
      // Ignore native modules and binary files that shouldn't be bundled for browser
      config.module.rules.push({
        test: /\.(node|wasm)$/,
        use: 'null-loader',
      });
      
      config.module.rules.push({
        test: /README\.md$/,
        use: 'null-loader',
      });
      
      // Ignore Electron-only service files in client builds
      config.module.rules.push({
        test: /RAGService\.ts$/,
        use: 'null-loader',
      });
      
      config.module.rules.push({
        test: /(KnowledgeBaseService|KnowledgeBaseRegistry|KnowledgeBaseMigrationService|DocumentParserService)\.ts$/,
        use: 'null-loader',
      });
      
      // Ignore Electron-only services that have native dependencies
      config.module.rules.push({
        test: /[\/\\](KnowledgeBaseService|KnowledgeBaseRegistry|RAGService|DocumentParserService|KnowledgeBaseMigrationService)\.ts$/,
        use: 'null-loader',
      });
      
      // Ignore specific native module directories
      config.resolve.alias = {
        ...config.resolve.alias,
        '@lancedb/vectordb-win32-x64-msvc': false,
        'onnxruntime-node': false,
        'sharp': false,
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