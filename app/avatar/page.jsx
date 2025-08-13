// app/lib/loadHeygenSdk.js
// Robust loader that returns the *constructor/class* no matter how the UMD/ESM exposes it.

export async function loadHeygenSdk() {
  // already present?
  if (globalThis.HeyGenStreamingAvatar) return normalizeCtor(globalThis.HeyGenStreamingAvatar);

  // try local shim first (sets window.HeyGenStreamingAvatar from esm.sh)
  await injectScript('/heygen.umd.js').catch(() => {});

  // CDN fallbacks (ignore error messages in console; we just continue)
  const cdns = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  ];
  for (const src of cdns) {
    if (globalThis.HeyGenStreamingAvatar) break;
    try { await injectScript(src); } catch { /* continue */ }
  }

  // last resort: give the page a moment to settle
  const t0 = Date.now();
  while (!globalThis.HeyGenStreamingAvatar && Date.now() - t0 < 1500) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (!globalThis.HeyGenStreamingAvatar) {
    throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
  }
  return normalizeCtor(globalThis.HeyGenStreamingAvatar);
}

function injectScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src + (src.startsWith('/') ? `?v=${Date.now()}` : '');
    s.onload = () => res();
    s.onerror = () => rej(new Error(`script failed: ${src}`));
    document.head.appendChild(s);
  });
}

// Some builds put the class on default, some as a named export, some directly as the global.
function normalizeCtor(mod) {
  const ctor =
    mod?.StreamingAvatar ||
    mod?.default?.StreamingAvatar ||
    mod?.default ||
    mod;

  console.log('[DBG] HeyGen global keys:', Object.keys(mod || {}));
  console.log('[DBG] Selected ctor type:', typeof ctor);

  return ctor;
}
