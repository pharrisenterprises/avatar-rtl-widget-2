// app/lib/loadHeygenSdk.js
// Safe for Next/Vercel: never import https:// at build time.
// Load UMD scripts, and if we fall back to /heygen.umd.js, wait until it promotes the ESM to window.*.

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => res();
    s.onerror = () => rej(new Error(`script failed: ${src}`));
    document.head.appendChild(s);
  });
}

function waitForGlobal(key, ms = 5000, step = 50) {
  return new Promise((res, rej) => {
    const t0 = Date.now();
    (function tick() {
      if (window[key]) return res(window[key]);
      if (Date.now() - t0 > ms) return rej(new Error(`global ${key} not ready`));
      setTimeout(tick, step);
    })();
  });
}

export async function loadHeygenSdk() {
  if (typeof window === 'undefined') throw new Error('window unavailable');

  // already present?
  if (window.HeyGenStreamingAvatar) {
    return normalizeCtor(window.HeyGenStreamingAvatar);
  }

  const cdns = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
  ];

  // Try the public UMD builds first
  for (const url of cdns) {
    try {
      console.log('[heygen loader] try:', url);
      await loadScript(url);
      if (window.HeyGenStreamingAvatar) {
        console.log('[heygen loader] ok:', url);
        return normalizeCtor(window.HeyGenStreamingAvatar);
      }
      throw new Error('loaded but no global');
    } catch (e) {
      console.warn('[heygen loader] failed:', url, e.message || e);
    }
  }

  // Fallback: local shim in /public that ESM-imports and sets the global
  try {
    const bust = Date.now();
    const local = `/heygen.umd.js?v=${bust}`;
    console.log('[heygen loader] try local shim:', local);
    await loadScript(local);
    const Ctor = await waitForGlobal('HeyGenStreamingAvatar', 8000);
    console.log('[heygen loader] shim ready');
    return normalizeCtor(Ctor);
  } catch (e) {
    console.error('[heygen loader] local shim failed', e);
    throw new Error('Failed to load HeyGen SDK from all sources');
  }
}

function normalizeCtor(RawCtor) {
  return class NormalizedHeygen extends RawCtor {
    constructor(opts) {
      super(opts);
      this.__lastSession = null;

      // If attachToElement already exists, keep it
      if (typeof this.attachToElement === 'function') return;

      // Alias a different helper name if present
      if (typeof this.attachElement === 'function') {
        this.attachToElement = (el) => this.attachElement(el);
        return;
      }

      // Universal attacher
      this.attachToElement = async (el) => {
        if (!el) throw new Error('attachToElement: missing video element');

        // API variant 1
        if (typeof this.getRemoteMediaStream === 'function') {
          const ms = await this.getRemoteMediaStream();
          if (ms) { el.srcObject = ms; await el.play().catch(() => {}); return; }
        }

        // API variant 2
        if (typeof this.getMediaStream === 'function') {
          const ms = await this.getMediaStream();
          if (ms) { el.srcObject = ms; await el.play().catch(() => {}); return; }
        }

        // Session-carried stream
        const s = this.__lastSession;
        const ms = s && (s.mediaStream || s.stream);
        if (ms) { el.srcObject = ms; await el.play().catch(() => {}); return; }

        throw new Error('No attach function or MediaStream available');
      };
    }

    async createStartAvatar(opts) {
      const session = await super.createStartAvatar(opts);
      this.__lastSession = session;
      return session;
    }
  };
}
