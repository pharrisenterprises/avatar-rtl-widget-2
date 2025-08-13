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
              // allow our page + cdns + data/blob
              "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data: blob:",
              // allow script imports from the CDNs + inline/eval for UMD shims
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
              // allow websocket+https to HeyGen + LiveKit + Retell + the CDNs
              "connect-src 'self' https://api.heygen.com wss://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh https://api.retellai.com wss://api.retellai.com",
              // allow images/media/fonts/styles we use
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: data: https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              // no iframes embedding us
              "frame-ancestors 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  }
};

export default nextConfig;
