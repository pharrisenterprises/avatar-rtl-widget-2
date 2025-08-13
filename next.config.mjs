/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data: blob:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
              // 👇 ADDED api.retellai.com here
              "connect-src 'self' https://api.retellai.com https://api.heygen.com wss://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: data: https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "frame-ancestors 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
