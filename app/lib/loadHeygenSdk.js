// app/lib/loadHeygenSdk.js
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') return;

  // If already loaded, done
  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  const candidates = [
    // 1) Local copy you just uploaded
    '/heygen.umd.js',
    // 2) esm.sh (UMD style via global-name)
    'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017&global-name=HeyGenStreamingAvatar',
    // 3) unpkg fallback
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    // 4) jsDelivr fallback
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js'
  ];

  for (const url of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url + (url.startsWith('/') ? `?v=${Date.now()}` : '');
        s.async = true;
        s.onload = () =>
          window.HeyGenStreamingAvatar
            ? resolve()
            : reject(new Error('Loaded but global not found'));
        s.onerror = () => reject(new Error('script load error'));
        document.head.appendChild(s);
      });
      // success
      return window.HeyGenStreamingAvatar;
    } catch (err) {
      // try next
    }
  }

  throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
}
