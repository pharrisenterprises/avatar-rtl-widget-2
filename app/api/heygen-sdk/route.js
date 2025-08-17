// /app/api/heygen-sdk/route.js
// Purpose: Serve the HeyGen Streaming Avatar UMD from a reliable source.
// We try multiple CDNs server-side and return the first success.
// NOTE: Keep this same-origin endpoint so CSP stays happy.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  'https://ga.jspm.io/npm:@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
];

async function fetchText(url) {
  const r = await fetch(url, {
    method: 'GET',
    headers: { 'user-agent': 'heygen-proxy/1.0 (+vercel)' },
    // allow the CDN to be cached by Vercel’s edge a bit
    next: { revalidate: 300 },
  });
  if (!r.ok) throw new Error(`bad status ${r.status}`);
  return await r.text();
}

export async function GET() {
  for (const url of SOURCES) {
    try {
      const body = await fetchText(url);
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'text/javascript; charset=utf-8',
          // let browsers cache briefly; you can tune this
          'cache-control': 'public, max-age=300',
        },
      });
    } catch {
      // try next source
    }
  }
  return new Response('/* [heygen-proxy] all CDN sources failed */', { status: 502 });
}

// (optional) make HEAD behave like GET for uptime checks
export async function HEAD() {
  return GET();
}
