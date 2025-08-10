/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Allow only your sites to embed the app in an iframe
          {
            key: 'Content-Security-Policy',
            value: [
              "frame-ancestors 'self'",
              'https://*.godaddysites.com',
              'https://*.godaddy.com',
              'https://*.wpcomstaging.com',
              'https://*.wordpress.com',
              // your future custom domain when you point it to WP
              'https://*.infinitysales.ai',
              // (optional) this exact staging host too
              'https://pharrisenterprises-qjmtx.wpcomstaging.com',
            ].join(' '),
          },
          // IMPORTANT: do NOT set X-Frame-Options: DENY/SAMEORIGIN anywhere else
        ],
      },
    ];
  },
};

module.exports = nextConfig;
