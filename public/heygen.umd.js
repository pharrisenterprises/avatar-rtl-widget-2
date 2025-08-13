/* Local shim → pulls the ESM build and exposes a UMD-like global */
(async () => {
  try {
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar');
    window.HeyGenStreamingAvatar = m.default || m;
    console.log('[heygen shim] SDK ready');
  } catch (e) {
    console.error('[heygen shim] import failed', e);
  }
})();
