// next.config.ts  (Repo A: avatar-rtl-widget-2)
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Allow your WordPress variants and your Vercel landing site to embed this app
            value: [
              "frame-ancestors 'self'",
              'https://*.godaddysites.com',
              'https://*.godaddy.com',
              'https://*.wpcomstaging.com',
              'https://*.wordpress.com',
              // allow your Infinity Sales domain (when you point to WP later)
              'https://*.infinitysales.ai',
              // allow ALL your infinity-landing deployments on vercel
              'https://*.vercel.app',
            ].join(' '),
          },
          // Do NOT set X-Frame-Options anywhere
        ],
      },
    ];
  },
};

export default nextConfig;
