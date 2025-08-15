// public/heygen.umd.js
// Browser shim: import the ESM build from a few mirrors and expose a UMD-like global.

(async () => {
  try {
    const mirrors = [
      // Primary: unpkg ESM bundle
      'https://unpkg.com/@heygen/streaming-avatar@2.0.16/es2017/streaming-avatar.bundle.mjs',
      // Fallback: jsDelivr ESM bundle
      'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/es2017/streaming-avatar.bundle.mjs',
      // Fallback: JSPM
      'https://ga.jspm.io/npm:@heygen/streaming-avatar@2.0.16/es2017/streaming-avatar.bundle.mjs',
    ];

    let mod = null, used = null;
    for (const url of mirrors) {
      try {
        mod = await import(/* @vite-ignore */ url);
        used = url;
        console.log('[heygen shim] loaded', url);
        break;
      } catch (e) {
        console.warn('[heygen shim] failed', url, e?.message || e);
      }
    }
    if (!mod) throw new Error('all ESM mirrors failed');

    const ctor =
      (mod && (mod.default || mod.StreamingAvatar || mod.HeyGenStreamingAvatar || mod.Client)) || null;
    if (typeof ctor !== 'function') {
      console.error('[heygen shim] unexpected module shape from', used, mod);
      throw new Error('no ctor in module');
    }

    window.HeyGenStreamingAvatar = ctor;
    console.log('[heygen shim] SDK ready');
  } catch (e) {
    console.error('[heygen shim] import failed', e);
  }
})();
