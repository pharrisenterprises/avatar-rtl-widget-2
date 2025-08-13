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
              // allow self + the script CDNs + data/blob for local fallbacks
              "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data: blob:",
              // we use a loader shim + UMD, so allow inline/eval and CDNs
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
              // *** CRITICAL ***: allow HeyGen APIs and LiveKit signaling/media endpoints
              "connect-src 'self' https://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh",
              // images & video frames
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: data: https:",
              // optional: calm the Google Fonts warnings you saw
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              // don’t allow other sites to embed your app
              "frame-ancestors 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
