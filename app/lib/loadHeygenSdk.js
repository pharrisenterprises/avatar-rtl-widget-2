// app/lib/loadHeygenSdk.js
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') return null;
  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  const SRCs = [
    'https://unpkg.com/@heygen/streaming-avatar@latest/dist/index.umd.js',
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@latest/dist/index.umd.js',
  ];

  let lastErr = null;
  for (const src of SRCs) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      });
      if (window.HeyGenStreamingAvatar) {
        console.log('[heygen] SDK loaded from', src);
        return window.HeyGenStreamingAvatar;
      }
    } catch (e) {
      lastErr = e;
      console.warn('[heygen] loader error:', e && e.message ? e.message : e);
    }
  }
  throw lastErr || new Error('Could not load HeyGen SDK from any CDN');
}
