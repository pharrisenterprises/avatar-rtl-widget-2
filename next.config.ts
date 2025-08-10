/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://*.godaddysites.com https://*.godaddy.com https://avatar-rtl-widget-2.vercel.app;"
          }
          // If you have other security headers, make sure they don't conflict
        ]
      }
    ];
  }
};

module.exports = nextConfig;
