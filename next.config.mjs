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
              // where scripts/media may load from
              "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://ga.jspm.io data: blob:",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://ga.jspm.io data:",
              "connect-src 'self' https://api.heygen.com wss://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://ga.jspm.io",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: data: https:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
              "font-src 'self' https://fonts.gstatic.com data:",
              // if you plan to iframe/embed this widget in other sites,
              // replace 'self' with your domain(s), e.g.:
              // \"frame-ancestors 'self' https://infinitysales.ai https://*.yourclient.com\"
              "frame-ancestors 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  },
  reactStrictMode: false,
};

export default nextConfig;
