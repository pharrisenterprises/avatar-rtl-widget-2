/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
      "connect-src 'self' https://api.heygen.com https://streaming.heygen.com https://*.heygen.ai",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "media-src 'self' blob: https:",
      "frame-ancestors *"
    ].join('; ');
    return [{ source: '/:path*', headers: [
      { key: 'Content-Security-Policy', value: csp },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ]}];
  }
};
export default nextConfig;
