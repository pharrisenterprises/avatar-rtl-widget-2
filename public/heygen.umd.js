// public/heygen.umd.js
(async () => {
  try {
    const mod = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017');
    // expose UMD-style global so our loader can find it
    window.HeyGenStreamingAvatar = mod.default || mod;
    console.log('[heygen shim] SDK ready');
  } catch (e) {
    console.error('[heygen shim] import failed', e);
  }
})();
