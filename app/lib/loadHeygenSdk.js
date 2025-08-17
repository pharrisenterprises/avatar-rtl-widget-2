// /app/lib/loadHeygenSdk.js
// Loads the HeyGen Streaming Avatar SDK in the browser.
// Strategy:
// 1) Try local proxy:  /api/heygen-sdk
// 2) If that somehow fails, try ESM dynamic import as last resort.

let cachedCtor = null;

function injectScriptOnce(src, checkReady, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    // If already present & ready, resolve immediately
    try {
      const ready = checkReady?.();
      if (ready) return resolve(ready);
    } catch {}

    const s = document.createElement('script');
    s.async = true;
    s.src = src;

    const onDone = () => {
      try {
        const ready = checkReady?.();
        if (ready) resolve(ready);
        else reject(new Error('script loaded but global not found'));
      } catch (e) {
        reject(e);
      }
    };

    s.onload = onDone;
    s.onerror = () => reject(new Error(`script failed: ${src}`));

    document.head.appendChild(s);

    setTimeout(() => reject(new Error('script timeout')), timeoutMs);
  });
}

function pickCtorFromGlobal() {
  // Try common global names the UMD may expose
  return (
    window.HeyGenStreamingAvatar ||
    (window.HeyGen && (window.HeyGen.StreamingAvatar || window.HeyGen.streamingAvatar)) ||
    window.streamingAvatar ||
    null
  );
}

export async function loadHeygenSdk() {
  if (cachedCtor) return cachedCtor;

  // 1) Local proxy (avoids CSP/external CDN failures)
  try {
    const ctor = await injectScriptOnce('/api/heygen-sdk', pickCtorFromGlobal);
    if (ctor) {
      cachedCtor = ctor;
      return ctor;
    }
    // fall through to ESM import
  } catch (e) {
    console.warn('[heygen loader] proxy failed:', e?.message);
  }

  // 2) Last-resort ESM dynamic import (may be blocked by CSP)
  try {
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017');
    cachedCtor = m.default || m.StreamingAvatar || m;
    return cachedCtor;
  } catch (e) {
    console.error('[heygen loader] ESM import failed', e);
    throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
  }
}
