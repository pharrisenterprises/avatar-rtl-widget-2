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
            // Allow your sites to iframe this app
            value: [
              "frame-ancestors 'self'",
              'https://*.vercel.app',
              'https://*.godaddysites.com',
              'https://*.godaddy.com',
              'https://*.wpcomstaging.com',
              'https://*.wordpress.com',
              'https://*.infinitysales.ai',
              'https://pharrisenterprises-qjmtx.wpcomstaging.com',
            ].join(' '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
