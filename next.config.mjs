/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [{
        key: 'Content-Security-Policy',
        value: [
          // allow our CDNs + LiveKit + HeyGen + ws
          "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data: blob:",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
          "connect-src 'self' https://api.heygen.com wss://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh https://api.retellai.com",
          "img-src 'self' data: blob: https:",
          "media-src 'self' blob: data: https:",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
          "font-src 'self' https://fonts.gstatic.com data:",
          "frame-ancestors 'self';"
        ].join('; ')
      }]
    }];
  },
  async redirects() {
    return [
      // Open root → go straight to widget
      { source: '/', destination: '/embed', permanent: false },
    ];
  },
};
export default nextConfig;
