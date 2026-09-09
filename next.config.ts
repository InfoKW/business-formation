import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Stripe webhook route needs the raw body - handled per-route via request.text()

  // Allow kelliworks.com to call the API from the WordPress landing page
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://kelliworks.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },

  webpack(config) {
    // In local mock-mode dev, stub out @insforge/sdk so the build succeeds
    // without the real SDK installed. The stub throws if actually invoked,
    // which should never happen because all routes return early via isMockMode().
    if (process.env.MOCK_DB === 'true') {
      config.resolve.alias['@insforge/sdk'] = path.join(
        process.cwd(),
        'src/lib/insforge-stub.ts',
      )
    }
    return config
  },
}

export default nextConfig
