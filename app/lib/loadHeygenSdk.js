// app/lib/loadHeygenSdk.js
export async function loadHeygenSdk() {
  if (typeof window === 'undefined') return null;
  // Already loaded?
  if (window.HeyGenStreamingAvatar) return window.HeyGenStreamingAvatar;

  // Load the UMD bundle from a CDN
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@heygen/streaming-avatar@latest/dist/index.umd.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load HeyGen SDK'));
    document.head.appendChild(s);
  });

  return window.HeyGenStreamingAvatar || null;
}
