// app/lib/loadHeygenSdk.js
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') throw new Error('SDK must load in the browser');

  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  // 0) Try a direct ESM import first (fastest + most reliable)
  try {
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar');
    window.HeyGenStreamingAvatar = m.default || m;
    return window.HeyGenStreamingAvatar;
  } catch (e) {
    console.warn('[heygen] direct import failed', e);
  }

  // 1) UMD CDNs
  const CDN  = 'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js';
  const UNPKG = 'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js';

  // 2) Our local shim (below) – sets window.HeyGenStreamingAvatar asynchronously
  const LOCAL = '/heygen.umd.js';

  // 3) API shim (optional extra fallback) – defined below
  const API = '/api/heygen-sdk';

  const sources = [CDN, UNPKG, LOCAL, API];

  async function addScript(src) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('load failed: ' + src));
      document.head.appendChild(s);
    });

    // LOCAL/API shims set the global after onload → poll briefly
    const needsPoll = src === LOCAL || src === API;
    if (window.HeyGenStreamingAvatar) return;
    if (needsPoll) {
      const t0 = Date.now();
      while (!window.HeyGenStreamingAvatar && Date.now() - t0 < 5000) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  for (const src of sources) {
    try {
      await addScript(src);
      if (window.HeyGenStreamingAvatar) {
        return window.HeyGenStreamingAvatar;
      }
    } catch (e) {
      console.warn('[heygen] SDK load failed from', src, e);
    }
  }

  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
