// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Allow only your sites to embed the Vercel app in an <iframe>
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'self'",
              'https://*.godaddysites.com',
              'https://*.godaddy.com',
              'https://*.wpcomstaging.com',
              'https://*.wordpress.com',
              'https://*.infinitysales.ai',
              'https://pharrisenterprises-qjmtx.wpcomstaging.com',
            ].join(' '),
          },
          // IMPORTANT: do not set X-Frame-Options anywhere (it conflicts with CSP)
        ],
      },
    ];
  },
};

export default nextConfig;
