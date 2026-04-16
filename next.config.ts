import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
  },
  serverExternalPackages: [],
  turbopack: {
    resolveAlias: {
      fs: { browser: './empty.js' },
      net: { browser: './empty.js' },
      tls: { browser: './empty.js' },
      path: { browser: './empty.js' },
      os: { browser: './empty.js' },
      crypto: { browser: './empty.js' },
    },
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        path: false,
        os: false,
        crypto: false,
      }
    }
    return config
  },
}

export default nextConfig
