// app/lib/loadHeygenSdk.js
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') return null;
  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  const bust = () => String(Date.now());
  const SOURCES = [
    // 1) your own copy (most reliable)
    `/heygen.umd.js?v=${bust()}`,
    // 2) CDNs as fallback
    `https://unpkg.com/@heygen/streaming-avatar@latest/dist/index.umd.js`,
    `https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@latest/dist/index.umd.js`,
  ];

  let lastErr = null;
  for (const src of SOURCES) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      });
      if (window.HeyGenStreamingAvatar) {
        console.log('[heygen] SDK loaded from', src);
        return window.HeyGenStreamingAvatar;
      }
    } catch (e) {
      lastErr = e;
      console.warn('[heygen] loader error:', e?.message || e);
    }
  }
  throw lastErr || new Error('Could not load HeyGen SDK from any source');
}
