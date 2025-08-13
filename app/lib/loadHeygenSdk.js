export async function loadHeygenSdk() {
  if (typeof window === 'undefined') throw new Error('SDK must load in the browser');
  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  // Prefer a direct ESM import (fast, reliable)
  try {
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar');
    window.HeyGenStreamingAvatar = m.default || m;
    return window.HeyGenStreamingAvatar;
  } catch {}

  // Fallbacks
  const sources = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    '/heygen.umd.js',
    '/api/heygen-sdk'
  ];

  for (const src of sources) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
        s.async = true;
        s.onload = res;
        s.onerror = () => rej(new Error('load failed ' + src));
        document.head.appendChild(s);
      });
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
      // local shims set the global after load → short poll
      const t0 = Date.now();
      while (!window.HeyGenStreamingAvatar && Date.now() - t0 < 5000) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 100));
      }
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
    } catch {}
  }
  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
