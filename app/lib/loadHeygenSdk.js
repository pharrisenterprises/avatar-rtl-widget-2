// app/lib/loadHeygenSdk.js
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') throw new Error('SDK must load in the browser');

  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  // Preferred pinned version – adjust only if HeyGen asks you to
  const CDN = 'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js';
  const UNPKG = 'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js';

  // Local shim (we’ll create this next). It dynamically imports from esm.sh and
  // sets window.HeyGenStreamingAvatar. Because the import is async, we also poll.
  const LOCAL = '/heygen.umd.js';

  // As a last-ditch, a data: URL that does a dynamic import from esm.sh.
  const DATA_ESM =
    "data:text/javascript,(async()=>{try{const m=await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017');window.HeyGenStreamingAvatar=m.default||m;}catch(e){console.error('[heygen data import failed]',e);}})();";

  const sources = [CDN, UNPKG, LOCAL, DATA_ESM];

  // Helper to add a script tag and (optionally) poll for the global
  async function addScript(src) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      if (src.startsWith('data:')) {
        // data: scripts can’t be cached; just inject
        s.src = src;
      } else {
        s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
      }
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load failed: ' + src));
      document.head.appendChild(s);
    });

    // If the SDK is there, we’re done
    if (window.HeyGenStreamingAvatar) return;

    // The LOCAL shim/data import sets the global *after* onload – wait for it
    const needsPoll = src === LOCAL || src.startsWith('data:');
    if (needsPoll) {
      const started = Date.now();
      while (!window.HeyGenStreamingAvatar && Date.now() - started < 5000) {
        // wait up to 5s
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
