<!-- public/heygen.umd.js -->
<script type="module">
  async function tryImport(url) {
    try {
      const m = await import(url);
      if (m?.default) return m.default;
      return m;
    } catch (e) {
      console.warn('[heygen shim] import failed:', url, e?.message || e);
      return null;
    }
  }

  // Try a few mirrors. No esm.sh.
  const sources = [
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/es2017/streaming-avatar.bundle.mjs',
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/es2017/streaming-avatar.bundle.mjs',
    // fallback via jspm (ga.jspm.io)
    'https://ga.jspm.io/npm:@heygen/streaming-avatar@2.0.16/es2017/streaming-avatar.bundle.mjs'
  ];

  let mod = null;
  for (const s of sources) {
    mod = await tryImport(s);
    if (mod) {
      console.log('[heygen shim] loaded', s);
      break;
    }
  }
  if (!mod) {
    console.error('[heygen shim] nothing loaded from mirrors');
  } else {
    // Expose a UMD-like global the rest of the app expects
    window.HeyGenStreamingAvatar = mod;
    console.log('[heygen shim] SDK ready');
  }
</script>
