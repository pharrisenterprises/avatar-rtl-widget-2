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
              // allow the CDNs + data/blob + LiveKit + HeyGen sockets
              "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh https://ga.jspm.io data: blob:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh https://ga.jspm.io data:",
              "connect-src 'self' https://api.heygen.com wss://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh https://ga.jspm.io",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: data: https:",
              "style-src 'self' 'unsafe-inline' https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              "frame-ancestors 'self';",
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
