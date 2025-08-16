// Loads HeyGen Streaming Avatar SDK with multiple fallbacks.
// 1) Local shim (/heygen.umd.js) + wait for __heygenReadyPromise
// 2) UMD on jsDelivr, unpkg, jspm (ga.jspm.io)
// 3) Direct ESM import (requires esm.sh allowed by CSP)

export async function loadHeygenSdk() {
  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error(`script failed: ${src}`));
      document.head.appendChild(s);
    });

  const waitForGlobal = async (timeoutMs = 10000) => {
    // Use the promise if shim provided it
    if (window.__heygenReadyPromise) {
      return await Promise.race([
        window.__heygenReadyPromise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('shim timeout')), timeoutMs)),
      ]);
    }
    // Poll otherwise
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error('shim timeout');
  };

  // 1) Local shim first
  try {
    const local = `/heygen.umd.js?v=${Date.now()}`;
    console.log('[heygen loader] try local shim:', local);
    await loadScript(local);
    const ctor = await waitForGlobal(12000);
    console.log('[heygen loader] shim ready');
    return ctor;
  } catch (err) {
    console.warn('[heygen loader] failed local shim:', err.message || err);
  }

  // 2) CDN UMDs
  const cdnList = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://ga.jspm.io/npm:@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  ];
  for (const url of cdnList) {
    try {
      console.log('[heygen loader] try:', url);
      await loadScript(url);
      if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;
      throw new Error('no global after UMD');
    } catch (e) {
      console.warn('[heygen loader] failed:', url, e.message || e);
    }
  }

  // 3) Last resort: direct ESM import
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
