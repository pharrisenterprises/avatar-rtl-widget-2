/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const csp = [
      "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://ga.jspm.io data: blob:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://ga.jspm.io data:",
      "connect-src 'self' https://api.heygen.com wss://api.heygen.com https://streaming.heygen.com https://*.heygen.ai https://*.livekit.cloud wss://*.livekit.cloud https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://ga.jspm.io",
      "img-src 'self' https: data: blob:",
      "media-src 'self' https: data: blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "frame-ancestors 'self'"
    ].join('; ');

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
export default nextConfig;
