/* HeyGen UMD shim — loads ESM bundle and exposes window.HeyGenStreamingAvatar
   Also exposes window.__heygenReadyPromise that resolves when global is ready. */
(function () {
  if (typeof window === 'undefined') return;

  const ESM_URL = 'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017';

  let resolveReady, rejectReady;
  const readyPromise = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });
  window.__heygenReadyPromise = readyPromise;

  async function boot() {
    try {
      const mod = await import(ESM_URL);
      window.HeyGenStreamingAvatar = mod?.default || mod;
      console.log('[heygen shim] SDK ready');
      resolveReady(window.HeyGenStreamingAvatar);
      // fire a DOM event too, in case someone prefers events
      try { window.dispatchEvent(new Event('heygen-ready')); } catch {}
    } catch (e) {
      console.error('[heygen shim] import failed', e);
      rejectReady(e);
    }
  }

  boot();
})();
