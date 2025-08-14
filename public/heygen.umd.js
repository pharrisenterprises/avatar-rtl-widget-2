// public/heygen.umd.js
// Browser-only shim: ESM-import the SDK and expose a global for UMD-style access.
(async () => {
  try {
    const url = 'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017';
    const m = await import(url);
    window.HeyGenStreamingAvatar = m.default || m;
    console.log('[heygen shim] SDK ready');
  } catch (e) {
    console.error('[heygen shim] import failed', e);
  }
})();
