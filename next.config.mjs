/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Content-Security-Policy that allows our script fallbacks
    const csp = [
      "default-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh data:",
      "connect-src 'self' https://api.heygen.com https://*.heygen.com https://streaming.heygen.com wss://streaming.heygen.com https://cdn.jsdelivr.net https://unpkg.com https://esm.sh https://cdn.esm.sh",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "frame-ancestors 'self';"
    ].join('; ');

    return [{
      source: '/:path*',
      headers: [{ key: 'Content-Security-Policy', value: csp }]
    }];
  }
};

export default nextConfig;
