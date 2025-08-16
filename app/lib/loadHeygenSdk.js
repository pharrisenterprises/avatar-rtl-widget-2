// app/lib/loadHeygenSdk.js
// Loads HeyGen Streaming Avatar SDK with multiple fallbacks.
// We PREFER the local shim to avoid CDN issues.

export async function loadHeygenSdk() {
  // helper to dynamically add a <script>
  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error(`script failed: ${src}`));
      document.head.appendChild(s);
    });

  // 1) Local shim first (served from /public)
  try {
    const local = `/heygen.umd.js?v=${Date.now()}`; // bust caches
    console.log('[heygen loader] try local shim:', local);
    await loadScript(local);
    if (window.HeyGenStreamingAvatar) {
      console.log('[heygen loader] shim ready');
      return window.HeyGenStreamingAvatar;
    }
    throw new Error(`${local} loaded but no global`);
  } catch (err) {
    console.warn('[heygen loader] failed local shim:', err.message || err);
  }

  // 2) CDN UMD (jsDelivr then unpkg) — still here as backup
  const cdnList = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js'
  ];
  for (const url of cdnList) {
    try {
      console.log('[heygen loader] try:', url);
      await loadScript(url);
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
      throw new Error(`${url} loaded but no global`);
    } catch (e) {
      console.warn('[heygen loader] failed:', url, e.message || e);
    }
  }

  // 3) Last resort: direct ESM import (if CSP allows)
  try {
    const esm = 'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017';
    console.log('[heygen loader] try ESM import:', esm);
    const mod = await import(/* webpackIgnore: true */ esm);
    return mod?.default || mod;
  } catch (e) {
    console.warn('[heygen loader] ESM import failed:', e.message || e);
  }

  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
