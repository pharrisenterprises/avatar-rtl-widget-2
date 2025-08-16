/* HeyGen UMD shim: loads the ESM build and exposes a global */
(() => {
  const boot = async () => {
    try {
      const url = 'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017';
      const mod = await import(/* @vite-ignore */ url);
      // Expose a UMD-like global for our loader and pages
      window.HeyGenStreamingAvatar = mod?.default || mod;
      console.log('[heygen shim] SDK ready');
    } catch (e) {
      console.error('[heygen shim] import failed', e);
    }
  };
  // Ensure after document is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
