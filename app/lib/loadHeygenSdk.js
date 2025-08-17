// /app/lib/loadHeygenSdk.js
// Loads the HeyGen Streaming Avatar UMD from *your* server via /api/heygen-sdk.
// No external imports, so Webpack won't try to bundle remote URLs.

let cachedCtor = null;

function injectScriptOnce(src, checkReady, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    // if already there, resolve
    try {
      const ready = checkReady?.();
      if (ready) return resolve(ready);
    } catch {}

    const s = document.createElement('script');
    s.async = true;
    s.src = src;

    const done = () => {
      try {
        const ready = checkReady?.();
        if (ready) resolve(ready);
        else reject(new Error('script loaded but global not found'));
      } catch (e) {
        reject(e);
      }
    };

    s.onload = done;
    s.onerror = () => reject(new Error(`script failed: ${src}`));
    document.head.appendChild(s);

    setTimeout(() => reject(new Error('script timeout')), timeoutMs);
  });
}

function pickCtorFromGlobal() {
  // Try the common global names the UMD may set
  return (
    window.HeyGenStreamingAvatar ||
    (window.HeyGen && (window.HeyGen.StreamingAvatar || window.HeyGen.streamingAvatar)) ||
    window.streamingAvatar ||
    null
  );
}

export async function loadHeygenSdk() {
  if (cachedCtor) return cachedCtor;

  // Always load from our local proxy (same-origin => CSP-safe, build-safe)
  const ctor = await injectScriptOnce('/api/heygen-sdk', pickCtorFromGlobal);
  if (!ctor) throw new Error('Failed to load HeyGen SDK via local proxy.');
  cachedCtor = ctor;
  return ctor;
}
