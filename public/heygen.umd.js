// Minimal browser shim that exposes a UMD-like global for the ESM SDK.
(async () => {
  try {
    const url = 'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017';
    const m = await import(url);
    // Expose a global the page code can read
    window.HeyGenStreamingAvatar = m.default || m;
    console.log('[heygen shim] SDK ready');
  } catch (e) {
    console.error('[heygen shim] import failed', e);
  }
})();
