// app/lib/loadHeygenSdk.js
// Loads the HeyGen Streaming Avatar SDK from one of several sources
// and returns a CONSTRUCTOR you can `new` with { token }.
//
// It supports modules that export:
//   - default (function/class)
//   - { StreamingAvatar: function/class }
//   - { HeyGenStreamingAvatar: function/class }
// and puts the chosen constructor on window.HeyGenStreamingAvatar for debugging.

let _ctor = null;
let _loading = null;

function pickCtor(mod) {
  if (!mod) return null;
  // candidates in order
  const cands = [
    mod.default,
    mod.StreamingAvatar,
    mod.HeyGenStreamingAvatar,
    mod.Client,
  ].filter(Boolean);
  const picked = cands.find((c) => typeof c === 'function') || null;
  return picked;
}

async function tryScript(src) {
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`script failed: ${src}`));
    document.head.appendChild(s);
  });
  // Some UMDs set a global
  const g = window.HeyGenStreamingAvatar;
  if (typeof g === 'function') return g;
  throw new Error('UMD global not present');
}

async function tryEsm(url) {
  const mod = await import(/* @vite-ignore */ url);
  // expose for debugging
  window.__HEYGEN_MODULE__ = mod;
  const ctor = pickCtor(mod);
  if (ctor) {
    window.HeyGenStreamingAvatar = ctor; // make it visible for other code paths
    return ctor;
  }
  throw new Error('ESM loaded but no ctor found');
}

export async function loadHeygenSdk() {
  if (_ctor) return _ctor;
  if (_loading) return _loading;

  const sources = [
    // UMDs (often down recently, but keep them first if they come back)
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    // Local shim that uses esm.sh (always available)
    '/heygen.umd.js',
    // Direct ESM as last resort (bypass local shim)
    'https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017',
  ];

  _loading = (async () => {
    for (const src of sources) {
      try {
        console.log('[heygen loader] try:', src);
        if (src.startsWith('http') && src.includes('esm.sh')) {
          const ctor = await tryEsm(src);
          console.log('[heygen loader] esm ok');
          return (_ctor = ctor);
        }
        if (src === '/heygen.umd.js') {
          // Local shim imports ESM then sets window.HeyGenStreamingAvatar
          await tryEsm('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017');
          if (typeof window.HeyGenStreamingAvatar === 'function') {
            console.log('[heygen loader] shim ready');
            return (_ctor = window.HeyGenStreamingAvatar);
          }
          throw new Error('/heygen.umd.js loaded but no global');
        }
        const ctor = await tryScript(src);
        console.log('[heygen loader] umd ok');
        return (_ctor = ctor);
      } catch (e) {
        console.warn('[heygen loader] failed:', src, e.message || e);
      }
    }
    throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
  })();

  return _loading;
}
