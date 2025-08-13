// Try several sources in order. Stops at the first one that sets window.HeyGenStreamingAvatar
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') return null;
  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  // Fallback list (in order)
  const sources = [
    '/api/heygen-sdk', // server shim (dynamic import inside)
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    '/heygen.umd.js' // local shim (imports from esm.sh)
  ];

  // helper: load <script> URL and wait
  const loadScript = (url) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script failed: ' + url));
    document.head.appendChild(s);
  });

  // First try the server shim via dynamic import (no <script> tag)
  try {
    await import('/api/heygen-sdk?v=' + Date.now());
    // it sets window.HeyGenStreamingAvatar asynchronously; spin until available
    const t0 = Date.now();
    while (!window.HeyGenStreamingAvatar && Date.now() - t0 < 5000) {
      await new Promise(r => setTimeout(r, 50));
    }
    if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
  } catch (_) {
    // ignore → fall through to <script> loaders
  }

  // Then try the UMD <script> sources
  for (const url of sources.slice(1)) {
    try {
      await loadScript(url);
      const t0 = Date.now();
      while (!window.HeyGenStreamingAvatar && Date.now() - t0 < 5000) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
    } catch (e) {
      console.warn('[heygen loader] failed:', url, e?.message || e);
    }
  }

  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
