// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Allow your widget to be embedded by these sites
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'self'",
              'https://*.vercel.app',
              'https://*.wordpress.com',
              'https://*.wpcomstaging.com',
              'https://*.godaddysites.com',
              'https://*.godaddy.com',
              'https://*.infinitysales.ai',
            ].join(' '),
          },
          // Do NOT set X-Frame-Options anywhere (it conflicts with CSP)
        ],
      },
    ];
  },
};

export default nextConfig;
