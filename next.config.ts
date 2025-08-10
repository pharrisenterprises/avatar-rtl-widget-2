// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Allow your widget to be embedded on WordPress (staging + WP.com),
            // your future domain, and GoDaddy if you still test there.
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://*.wpcomstaging.com https://*.wordpress.com https://pharrisenterprises-qjmtx.wpcomstaging.com https://infinitysales.ai https://*.godaddysites.com https://*.godaddy.com;"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
