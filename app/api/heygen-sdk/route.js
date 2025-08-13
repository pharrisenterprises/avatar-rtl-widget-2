export const dynamic = 'force-dynamic';

export async function GET() {
  const src = `
/* server-delivered shim → same as /public/heygen.umd.js */
(async () => {
  try {
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar');
    window.HeyGenStreamingAvatar = m.default || m;
    console.log('[heygen api-shim] SDK ready');
  } catch (e) {
    console.error('[heygen api-shim] import failed', e);
  }
})();
  `.trim();

  return new Response(src, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
