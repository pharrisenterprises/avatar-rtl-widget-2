// /app/api/heygen-sdk/route.js
// Proxies the HeyGen Streaming Avatar UMD to avoid CDN/CSP issues.
// Falls back across a few popular CDNs and returns the first working script.

export const dynamic = 'force-dynamic';

const CANDIDATES = [
  // (Keep 2.0.16 to match your code; you can bump later if needed)
  'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  'https://ga.jspm.io/npm:@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
];

export async function GET() {
  for (const url of CANDIDATES) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const js = await r.text();
        return new Response(js, {
          status: 200,
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
    } catch {
      // try next
    }
  }
  return new Response(
    `console.error("[heygen-proxy] all CDN sources failed");`,
    { status: 502, headers: { 'Content-Type': 'application/javascript' } }
  );
}
