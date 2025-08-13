(async () => {
  try {
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar');
    window.HeyGenStreamingAvatar = m.default || m;
  } catch (e) {
    console.error('[heygen shim] import failed', e);
  }
})();
