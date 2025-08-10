/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Be specific: list your real domain(s)
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://*.godaddysites.com https://*.godaddy.com;" },
          // Avoid X-Frame-Options DENY/SAMEORIGIN if you set it elsewhere
        ],
      },
    ];
  },
};

module.exports = nextConfig;
