// /app/lib/loadHeygenSdk.js
// Loads HeyGen UMD at runtime via <script>, trying CDNs first, then our local proxy.
// No ESM imports -> avoids Webpack "UnhandledScheme" issues during build.

let cachedCtor = null;

function pickCtorFromGlobal() {
  return (
    // most common
    window.HeyGenStreamingAvatar ||
    // some builds hang a namespace
    (window.HeyGen && (window.HeyGen.StreamingAvatar || window.HeyGen.streamingAvatar)) ||
    // ultra-simple globals
    window.streamingAvatar ||
    null
  );
}

function injectScriptOnce(src, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    // already ready?
    const ready = pickCtorFromGlobal();
    if (ready) return resolve(ready);

    const s = document.createElement('script');
    s.async = true;
    s.src = src;

    const onDone = () => {
      const ctor = pickCtorFromGlobal();
      if (ctor) resolve(ctor);
      else reject(new Error(`script loaded but global not found: ${src}`));
    };

    s.onload = onDone;
    s.onerror = () => reject(new Error(`script failed: ${src}`));
    document.head.appendChild(s);

    setTimeout(() => reject(new Error('script timeout')), timeoutMs);
  });
}

export async function loadHeygenSdk() {
  if (cachedCtor) return cachedCtor;

  const SOURCES = [
    // best shot first
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://ga.jspm.io/npm:@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    // final fallback: our proxy (same-origin, CSP-safe)
    '/api/heygen-sdk',
  ];

  let lastErr;
  for (const src of SOURCES) {
    try {
      const ctor = await injectScriptOnce(src);
      if (!ctor) throw new Error('no ctor');
      cachedCtor = ctor;
      return ctor;
    } catch (e) {
      lastErr = e;
      // try next source
    }
  }
  throw lastErr || new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
