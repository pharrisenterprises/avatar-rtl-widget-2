// Resilient loader. Tries UMD (jsDelivr/unpkg) then falls back to ESM shim (esm.sh).
export async function loadHeygenSdk() {
  if (typeof window !== 'undefined' && window.HeyGenStreamingAvatar) {
    return window.HeyGenStreamingAvatar;
  }

  const tryScript = (src) =>
    new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
      s.async = true;
      s.onload = () => window.HeyGenStreamingAvatar ? res(window.HeyGenStreamingAvatar) : rej(new Error('loaded but no global'));
      s.onerror = () => rej(new Error('script failed: ' + src));
      document.head.appendChild(s);
    });

  const sources = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    '/heygen.umd.js',       // your local shim in /public
  ];

  // UMD attempts
  for (const src of sources) {
    try {
      // eslint-disable-next-line no-console
      console.log('[heygen loader] try:', src);
      return await tryScript(src);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[heygen loader] failed:', src, e.message || e);
    }
  }

  // ESM fallback: import and hoist to a global
  try {
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017');
    window.HeyGenStreamingAvatar = m.default || m;
    // eslint-disable-next-line no-console
    console.log('[heygen loader] ESM shim ready');
    return window.HeyGenStreamingAvatar;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[heygen loader] total failure', e);
    throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
  }
}
