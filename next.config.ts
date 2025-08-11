// next.config.ts  (avatar-rtl-widget-2)
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            // Allow your sites to embed this app in an <iframe>
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'self'",
              'https://*.godaddysites.com',
              'https://*.godaddy.com',
              'https://*.wpcomstaging.com',
              'https://*.wordpress.com',
              'https://*.infinitysales.ai',
              // 👇 add Vercel landing domains
              'https://*.vercel.app',
              // If you prefer to be very strict, you can replace the line above
              // with the exact landing host:
              // 'https://infinity-landing-*.vercel.app'
            ].join(' '),
          },
          // IMPORTANT: do not set X-Frame-Options anywhere (it conflicts with CSP)
        ],
      },
    ];
  },
};

export default nextConfig;
