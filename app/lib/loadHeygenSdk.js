// app/lib/loadHeygenSdk.js
// Loads HeyGen Streaming Avatar SDK from several CDNs,
// and returns a constructor that ALWAYS has attachToElement(video)

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

export async function loadHeygenSdk() {
  if (typeof window === 'undefined') throw new Error('window unavailable');

  // If global already exists, wrap & return immediately
  if (window.HeyGenStreamingAvatar) {
    return makeNormalizedCtor(window.HeyGenStreamingAvatar);
  }

  const cdns = [
    'https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    'https://unpkg.com/@heygen/streaming-avatar@2.0.16/dist/index.umd.js',
    // local file that shims ESM → global (you already have this):
    '/heygen.umd.js'
  ];

  let lastErr = null;

  // Try UMDs first
  for (const url of cdns) {
    try {
      console.log('[heygen loader] try:', url);
      await loadScript(url);
      if (window.HeyGenStreamingAvatar) {
        console.log('[heygen loader] ok:', url);
        return makeNormalizedCtor(window.HeyGenStreamingAvatar);
      }
      throw new Error('loaded but no global');
    } catch (e) {
      console.warn('[heygen loader] failed:', url, e.message || e);
      lastErr = e;
    }
  }

  // FINAL FALLBACK — direct ESM import from esm.sh, then promote to global
  try {
    console.log('[heygen loader] using ESM fallback');
    const m = await import('https://esm.sh/@heygen/streaming-avatar@2.0.16?bundle&target=es2017');
    const Ctor = m?.default || m;
    if (!Ctor) throw new Error('esm missing default export');
    window.HeyGenStreamingAvatar = Ctor; // expose for others
    return makeNormalizedCtor(Ctor);
  } catch (e) {
    console.error('[heygen loader] esm import failed', e);
    throw lastErr || e || new Error('Failed to load HeyGen SDK from all sources');
  }
}

/**
 * Wrap/patch the provided constructor so every instance supports:
 *   - createStartAvatar(opts)
 *   - attachToElement(videoEl)  ← we ensure this method exists and works
 */
function makeNormalizedCtor(RawCtor) {
  return class NormalizedHeygen extends RawCtor {
    constructor(opts) {
      super(opts);
      this.__lastSession = null;

      // If a helper already exists, keep it
      if (typeof this.attachToElement === 'function') return;

      // If a differently named helper exists, alias it
      if (typeof this.attachElement === 'function') {
        this.attachToElement = (el) => this.attachElement(el);
        return;
      }

      // Otherwise install a universal attachToElement
      this.attachToElement = async (el) => {
        if (!el) throw new Error('attachToElement: missing video element');

        // 1) official getter (some esm builds expose this)
        if (typeof this.getRemoteMediaStream === 'function') {
          const ms = await this.getRemoteMediaStream();
          if (ms && typeof ms === 'object') {
            el.srcObject = ms;
            await el.play().catch(() => {});
            return;
          }
        }

        // 2) a very similar getter name
        if (typeof this.getMediaStream === 'function') {
          const ms = await this.getMediaStream();
          if (ms && typeof ms === 'object') {
            el.srcObject = ms;
            await el.play().catch(() => {});
            return;
          }
        }

        // 3) session carried the stream
        const sess = this.__lastSession;
        const ms = sess && (sess.mediaStream || sess.stream);
        if (ms) {
          el.srcObject = ms;
          await el.play().catch(() => {});
          return;
        }

        throw new Error('No attach function or MediaStream available');
      };
    }

    // Wrap start to remember the session for the universal attacher
    async createStartAvatar(opts) {
      const session = await super.createStartAvatar(opts);
      this.__lastSession = session;
      return session;
    }
  };
}
