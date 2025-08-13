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
              // allow self + CDN scripts + data/blob
              "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data: blob:",
              // loader shim + UMD → allow inline/eval and CDNs
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
              // *** CRITICAL ***: HeyGen APIs + WebSockets and LiveKit signal/media
              "connect-src 'self' https://api.heygen.com wss://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh",
              // images & media
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: data: https:",
              // optional: quiet Google Fonts warning you saw
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              // prevent framing by other sites
              "frame-ancestors 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
