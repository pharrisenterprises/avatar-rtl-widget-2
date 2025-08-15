// app/lib/loadHeygenSdk.js
export async function loadHeygenSdk() {
  // if already present
  if (typeof window !== 'undefined' && window.HeyGenStreamingAvatar) {
    return window.HeyGenStreamingAvatar;
  }

  // try CDN UMD first
  const candidates = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    '/heygen.umd.js' // our local shim (loads ESM and sets the global)
  ];

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () =>
        window.HeyGenStreamingAvatar
          ? resolve(window.HeyGenStreamingAvatar)
          : reject(new Error(`${src} loaded but no global`));
      s.onerror = () => reject(new Error(`script failed: ${src}`));
      document.head.appendChild(s);
    });

  let lastErr;
  for (const src of candidates) {
    try {
      console.log('[heygen loader] try:', src);
      const sdk = await loadScript(src);
      console.log('[heygen loader] ready from:', src);
      return sdk;
    } catch (e) {
      console.warn('[heygen loader] failed:', src, e.message || e);
      lastErr = e;
    }
  }
  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
