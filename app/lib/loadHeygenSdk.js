// app/lib/loadHeygenSdk.js
// Loads HeyGen Streaming Avatar SDK with multiple fallbacks.
// 1) jsDelivr (UMD) → 2) unpkg (UMD) → 3) esm.sh (module) → 4) local /heygen.umd.js (module or UMD)
// Succeeds when window.HeyGenStreamingAvatar is available.

const TIMEOUT_MS = 15000;

function waitForGlobal(name, timeout = TIMEOUT_MS) {
  return new Promise((res, rej) => {
    const started = Date.now();
    (function poll() {
      if (globalThis[name]) return res(globalThis[name]);
      if (Date.now() - started > timeout) return rej(new Error(`Timeout waiting for ${name}`));
      setTimeout(poll, 50);
    })();
  });
}

function injectScript(src, { module = false } = {}) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    if (module) s.type = 'module';
    s.src = src;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function tryLoad() {
  // Try plain UMDs first
  const umds = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@latest/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@latest/dist/index.umd.js'
  ];

  for (const url of umds) {
    try {
      await injectScript(url);
      await waitForGlobal('HeyGenStreamingAvatar', 5000);
      return globalThis.HeyGenStreamingAvatar;
    } catch (_) {}
  }

  // Try esm.sh as a module that assigns to window
  // The ?bundle builds a single file; we set a global name via an inlined helper
  try {
    await injectScript(
      `data:text/javascript;charset=utf-8,` +
      encodeURIComponent(`
        import HG from "https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2018";
        window.HeyGenStreamingAvatar = HG?.default ?? HG;
      `),
      { module: true }
    );
    await waitForGlobal('HeyGenStreamingAvatar', 7000);
    return globalThis.HeyGenStreamingAvatar;
  } catch (_) {}

  // Last resort: load your *local* copy (module) and set the global
  // (works if you saved a working build at /heygen.umd.js or a module build)
  try {
    await injectScript(
      `data:text/javascript;charset=utf-8,` +
      encodeURIComponent(`
        import HG from "/heygen.umd.js";
        window.HeyGenStreamingAvatar = HG?.default ?? HG;
      `),
      { module: true }
    );
    await waitForGlobal('HeyGenStreamingAvatar', 7000);
    return globalThis.HeyGenStreamingAvatar;
  } catch (e) {
    throw new Error('Failed to load HeyGen Streaming Avatar SDK from all sources.');
  }
}

let loadingPromise = null;

/** Call this from your pages before you start the avatar */
export async function loadHeygenSdk() {
  if (globalThis.HeyGenStreamingAvatar) return globalThis.HeyGenStreamingAvatar;
  if (!loadingPromise) loadingPromise = tryLoad();
  return loadingPromise;
}
