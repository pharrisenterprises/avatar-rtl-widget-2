<!-- public/heygen.umd.js -->
<script>
(async function boot() {
  try {
    const mod = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017');
    window.HeyGenStreamingAvatar = mod.default || mod;
    console.log('[heygen shim] SDK ready');
  } catch (e) {
    console.error('[heygen shim] import failed', e);
  }
})();
</script>
