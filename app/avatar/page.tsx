'use client';

import { useEffect, useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';

export default function AvatarBridge() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);
  const [debug, setDebug] = useState<string>('—');

  // Rolling agent full text for the current turn + how much we’ve already spoken
  const agentFullRef = useRef<string>('');
  const spokenIdxRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  // Queue to avoid overlapping speaks
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // ===== HARD SILENCE for anything that isn’t our HeyGen <video> =====
  useEffect(() => {
    // mark our video so we allow it to play with audio
    if (videoRef.current) {
      (videoRef.current as any).dataset.allowPlay = '1';
    }

    const origPlay = (HTMLMediaElement.prototype as any).play;
    const patchedPlay = function (this: HTMLMediaElement, ...args: any[]) {
      const allow = (this as any)?.dataset?.allowPlay === '1';
      if (!allow) {
        try { this.muted = true; this.volume = 0; } catch {}
      }
      try {
        const p = origPlay.apply(this, args);
        if (p && typeof (p as any).catch === 'function') return (p as any).catch(() => undefined);
        return p;
      } catch {
        return Promise.resolve();
      }
    };
    (HTMLMediaElement.prototype as any).play = patchedPlay;

    const smash = () => {
      const ours = videoRef.current;
      document.querySelectorAll('audio, video').forEach((el) => {
        const m = el as HTMLMediaElement;
        const allow = (m as any)?.dataset?.allowPlay === '1';
        if (!allow || (ours && m !== ours)) {
          try { m.muted = true; m.volume = 0; m.pause?.(); } catch {}
        }
      });
    };
    const mo = new MutationObserver(smash);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    const interval = window.setInterval(smash, 500);

    return () => {
      (HTMLMediaElement.prototype as any).play = origPlay;
      mo.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  // ===== HeyGen speak helpers =====
  async function safeSpeak(a: StreamingAvatar, text: string) {
    const t = text.trim();
    if (!t) return;
    try {
      await a.speak({ text: t, task_type: TaskType.REPEAT } as any);
      setCaptions((prev) => [...prev.slice(-10), t]);
    } catch (err) {
      console.error('[HeyGen] speak failed:', err);
      setMsg('Error: speak() failed. See console.');
    }
  }

  async function drainSpeakQueue(a: StreamingAvatar) {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length > 0) {
        const chunk = speakQueueRef.current.shift();
        if (!chunk) break;
        await safeSpeak(a, chunk);
      }
    } finally {
      speakingRef.current = false;
    }
  }

  function enqueueToSpeak(text: string) {
    const t = text.trim();
    if (!t) return;
    speakQueueRef.current.push(t);
    if (avatar) void drainSpeakQueue(avatar);
  }

  // ===== Retell text extraction (deep + robust) =====
  function isUserRole(o: any): boolean {
    const role = (o?.role || o?.speaker || o?.source || o?.who || '').toString().toLowerCase();
    return role.includes('user');
  }

  // Recursively collect candidate strings from keys we care about
  function deepCollectAgentStrings(o: any, seen: Set<any>, acc: string[] = []): string[] {
    if (!o || typeof o !== 'object' || seen.has(o)) return acc;
    seen.add(o);

    // If object marks user role, skip
    if (isUserRole(o)) return acc;

    // Scan own props
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && /text|transcript|content|message/i.test(k)) {
        const s = v.trim();
        if (s) acc.push(s);
      }
      if (Array.isArray(v) && /transcript/i.test(k)) {
        for (const item of v) {
          if (item && typeof item === 'object' && !isUserRole(item)) {
            const x = (item as any).text || (item as any).transcript || (item as any).content || (item as any).message || '';
            const s = String(x).trim();
            if (s) acc.push(s);
          }
        }
      }
      if (v && typeof v === 'object') {
        deepCollectAgentStrings(v, seen, acc);
      }
    }
    return acc;
  }

  function normalizeAgentFull(candidates: string[]): string {
    if (candidates.length === 0) return '';
    const longest = candidates.reduce((a, b) => (a.length >= b.length ? a : b), '');
    const joined = candidates.join(' ');
    const full = (longest.length > joined.length ? longest : joined).replace(/\s+/g, ' ').trim();
    return full;
  }

  function splitCompletedSince(lastIdx: number, full: string) {
    const newChunk = full.slice(lastIdx);
    if (!newChunk) return { completed: [] as string[], consumed: 0 };
    const re = /[^.!?…]+[.!?…]+["')]*\s*/g;
    const completed: string[] = [];
    let consumed = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(newChunk)) !== null) {
      completed.push(m[0].trim());
      consumed = m.index + m[0].length;
    }
    return { completed, consumed };
  }

  function tryFlushTail(forceFinal: boolean) {
    const full = agentFullRef.current;
    const last = spokenIdxRef.current;
    if (full.length <= last) return;

    const { completed, consumed } = splitCompletedSince(last, full);
    if (completed.length) {
      spokenIdxRef.current = last + consumed;
      completed.forEach((s) => enqueueToSpeak(s));
    }
    if (forceFinal && spokenIdxRef.current < full.length) {
      const tail = full.slice(spokenIdxRef.current).trim();
      if (tail) {
        spokenIdxRef.current = full.length;
        enqueueToSpeak(tail);
      }
    }
  }

  function handleRetellUpdate(u: any) {
    const candidates = deepCollectAgentStrings(u, new Set());
    setDebug(candidates.length ? `found ${candidates.length}` : 'no-agent-text');

    const full = normalizeAgentFull(candidates);
    if (!full) return;

    agentFullRef.current = full;

    // debounce: if agent pauses, flush remaining
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => tryFlushTail(true), 1200);

    // speak newly completed sentences now
    tryFlushTail(false);
  }

  // ===== Start flow =====
  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // Retell
      const r1 = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!r1.ok) throw new Error('Retell token failed: ' + r1.status);
      const { access_token } = await r1.json();

      const retell = new RetellWebClient();
      await retell.startCall({ accessToken: access_token });
      console.log('[Retell] call started');

      retell.on?.('update', (u: any) => {
        try { handleRetellUpdate(u); } catch (e) { console.error('parse update failed', e); }
      });
      retell.on?.('agent_stop_talking', () => tryFlushTail(true));
      retell.on?.('error', (e: any) => console.error('[Retell] error', e));

      // HeyGen
      const r2 = await fetch('/api/heygen-token', { method: 'POST' });
      if (!r2.ok) throw new Error('HeyGen token failed: ' + r2.status);
      const { token } = await r2.json();

      const a = new StreamingAvatar({ token });
      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          (videoRef.current as any).dataset.allowPlay = '1';
          videoRef.current.muted = false;
          videoRef.current.volume = 1;
          videoRef.current.play().catch(() => {});
        }
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Avatar mirrors agent (sentences only).');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  // manual sanity button
  async function sayTest() {
    if (!avatar) return;
    enqueueToSpeak('Manual test line. You should hear me and see my mouth move.');
    await drainSpeakQueue(avatar);
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell x HeyGen Avatar Bridge - /avatar</h1>
      <p>Status: <strong>{status}</strong></p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={start}
          style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}
        >
          Start
        </button>
        <button
          onClick={sayTest}
          style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}
        >
          Say test line
        </button>
      </div>

      <p style={{ marginTop: 12 }}>{msg}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          maxWidth: 860,
          aspectRatio: '16/9',
          background: '#000',
          borderRadius: 12,
          marginTop: 16,
        }}
      />

      {/* Captions: exactly what we send to HeyGen */}
      <div
        style={{
          marginTop: 12,
          padding: '12px 14px',
          borderRadius: 10,
          background: '#111',
          color: '#fff',
          lineHeight: 1.5,
          fontSize: 16,
          maxWidth: 860,
        }}
      >
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Agent captions</div>
        {captions.length === 0 ? (
          <div style={{ opacity: 0.6 }}>…waiting for agent</div>
        ) : (
          captions.map((c, i) => (
            <div key={i} style={{ margin: '4px 0' }}>• {c}</div>
          ))
        )}
      </div>

      {/* tiny debug indicator */}
      <div
        style={{
          position: 'fixed',
          right: 8,
          bottom: 8,
          background: '#111',
          color: '#9ae6b4',
          padding: '6px 8px',
          borderRadius: 8,
          fontSize: 12,
          opacity: 0.9,
        }}
      >
        src: {debug}
      </div>
    </main>
  );
}
