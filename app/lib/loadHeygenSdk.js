// Loads HeyGen Streaming Avatar SDK only in the browser.
// IMPORTANT: we "hide" the dynamic import from Webpack so it doesn't try to fetch at build time.
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') {
    throw new Error('SDK must load in the browser');
  }
  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  // Helper that avoids static analysis:
  const dynImport = async (u) => {
    // use Function constructor so bundler won't rewrite this
    return await (new Function('u', 'return import(u)'))(u);
  };

  // 1) Prefer ESM build (runtime only)
  try {
    const url = 'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar';
    const m = await dynImport(url);
    window.HeyGenStreamingAvatar = m.default || m;
    return window.HeyGenStreamingAvatar;
  } catch (_) {}

  // 2) UMD fallbacks (CDNs → local shim → API shim)
  const sources = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    '/heygen.umd.js',
    '/api/heygen-sdk',
  ];

  for (const src of sources) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
        s.async = true;
        s.onload = res;
        s.onerror = () => rej(new Error('load failed: ' + src));
        document.head.appendChild(s);
      });

      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

      const t0 = Date.now();
      while (!window.HeyGenStreamingAvatar && Date.now() - t0 < 4000) {
        // wait up to 4s for the global
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 100));
      }
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
    } catch (_) {}
  }
  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
