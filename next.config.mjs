/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [{
        key: 'Content-Security-Policy',
        value: [
          // allow base & CDNs & data URIs
          "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
          // scripts (permit inline/eval because 3rd-party UMDs sometimes need it)
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh",
          // XHR/WebSocket targets: HeyGen APIs + LiveKit (https & wss)
          "connect-src 'self' https://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh wss://api.heygen.com",
          // media/video blobs
          "media-src 'self' blob: data:",
          // images (incl. data blobs from canvases)
          "img-src 'self' data: blob: https:",
          // styles (optional Google Fonts)
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com",
          // fonts (optional Google Fonts)
          "font-src 'self' https://fonts.gstatic.com data:",
          // frame embedding
          "frame-ancestors 'self';"
        ].join('; ')
      }]
    }];
  }
};
export default nextConfig;
