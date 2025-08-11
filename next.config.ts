// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // allow the landing site to iframe the avatar
            value: [
              "frame-ancestors 'self'",
              'https://*.godaddysites.com',
              'https://*.godaddy.com',
              'https://*.wpcomstaging.com',
              'https://*.wordpress.com',
              'https://*.infinitysales.ai',
              'https://*.vercel.app',                         // <— add this
              'https://pharrisenterprises-qjmtx.wpcomstaging.com'
            ].join(' ')
          }
          // Do NOT set X-Frame-Options anywhere; CSP replaces it.
        ]
      }
    ];
  }
};

export default nextConfig;
