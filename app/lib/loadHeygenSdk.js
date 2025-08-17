// Loads the HeyGen Streaming Avatar SDK in the browser.
// 1) Try the local shim (public/heygen.umd.js) which sets window.HeyGenStreamingAvatar
// 2) Fallback to UMD CDNs
// 3) Last resort: dynamic ESM import from esm.sh

function loadScript(src, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => reject(new Error(`script failed: ${src}`));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('shim timeout')), timeoutMs);
  });
}

export async function loadHeygenSdk() {
  // Try local shim (this will ESM-import and set a global)
  try {
    await loadScript('/heygen.umd.js?v=' + Date.now());
    if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
  } catch {}

  // UMD CDNs
  const cdnUrls = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://ga.jspm.io/npm:@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  ];
  for (const u of cdnUrls) {
    try {
      await loadScript(u);
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
    } catch (e) {
      console.warn('[heygen loader] failed:', u, e.message);
    }
  }

  // ESM fallback
  try {
    const url = 'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017';
    const m = await import(url);
    return m.default || m;
  } catch (e) {
    console.error('[heygen loader] ESM import failed', e);
  }

  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
