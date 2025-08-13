export const dynamic = 'force-dynamic';

export async function GET() {
  const code = `
  (async () => {
    try {
      const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar');
      window.HeyGenStreamingAvatar = m.default || m;
      console.log('[heygen api-shim] SDK ready');
    } catch (e) {
      console.error('[heygen api-shim] import failed', e);
    }
  })();`;
  return new Response(code, {
    headers: { 'content-type': 'application/javascript; charset=utf-8' }
  });
}
