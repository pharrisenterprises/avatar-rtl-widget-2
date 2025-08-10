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

  // Debug telemetry
  const [silenceRetell, setSilenceRetell] = useState<boolean>(true);
  const [updatesSeen, setUpdatesSeen] = useState<number>(0);
  const [candidatesCount, setCandidatesCount] = useState<number>(0);
  const [sampleText, setSampleText] = useState<string>('—');

  // Rolling agent text this turn + how much we’ve already spoken
  const agentFullRef = useRef<string>('');
  const spokenIdxRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  // Speak queue (no overlap)
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // ========== Helpers: mute non-avatar media (safe version) ==========
  useEffect(() => {
    const tick = () => {
      if (!silenceRetell) return;
      const ours = videoRef.current;
      document.querySelectorAll('audio, video').forEach((el) => {
        const m = el as HTMLMediaElement;
        if (ours && m === ours) {
          // keep HeyGen audible
          m.muted = false;
          m.volume = 1;
          return;
        }
        try { m.muted = true; m.volume = 0; } catch {}
      });
    };
    const interval = window.setInterval(tick, 400);
    return () => window.clearInterval(interval);
  }, [silenceRetell]);

  // ========== HeyGen speak helpers ==========
  async function safeSpeak(a: StreamingAvatar, text: string) {
    const t = (text || '').trim();
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
    const t = (text || '').trim();
    if (!t) return;
    speakQueueRef.current.push(t);
    if (avatar) void drainSpeakQueue(avatar);
  }

  // ========== Retell text extraction (robust but simple) ==========
  function isUserRole(o: any): boolean {
    const role = (o?.role || o?.speaker || o?.source || o?.who || '').toString().toLowerCase();
    return role.includes('user');
  }

  function collectCandidates(u: any): string[] {
    const out: string[] = [];

    // 1) Rolling transcript array
    if (Array.isArray(u?.transcript)) {
      const arr = u.transcript as any[];
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        if (isUserRole(item)) continue;
        const s = item.text ?? item.transcript ?? item.content ?? item.message;
        if (typeof s === 'string' && s.trim()) out.push(s.trim());
      }
    }

    // 2) Common agent carriers
    const s2 =
      u?.agent_response?.content ??
      u?.agent_message?.text ??
      u?.agent_message?.content ??
      (u?.message && (u.message.role === 'assistant' || u.message.role === 'agent') ? (u.message.text ?? u.message.content ?? u.message.transcript ?? u.message.message) : undefined) ??
      u?.text ?? u?.content ?? u?.transcript ?? u?.message;

    if (typeof s2 === 'string' && s2.trim()) out.push(s2.trim());

    return out;
  }

  function normalizeFull(candidates: string[]): string {
    if (!candidates.length) return '';
    // Take the longest; fallback to joined
    const longest = candidates.reduce((a, b) => (a.length >= b.length ? a : b), '');
    const joined = candidates.join(' ');
    return (longest.length > joined.length ? longest : joined).replace(/\s+/g, ' ').trim();
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
    setUpdatesSeen((n) => n + 1);

    const candidates = collectCandidates(u);
    setCandidatesCount(candidates.length);
    setSampleText(candidates[0]?.slice(0, 140) || '—');

    const full = normalizeFull(candidates);
    if (!full) return;

    agentFullRef.current = full;

    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => tryFlushTail(true), 1200);

    tryFlushTail(false);
  }

  // ========== Start flow ==========
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
        // console.log('[Retell] update', u);
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
          videoRef.current.muted = false;  // we want HeyGen audio
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

  // Manual sanity: speak arbitrary text via HeyGen
  async function speakManual(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!avatar) return;
    const fd = new FormData(e.currentTarget);
    const t = String(fd.get('say') || '');
    enqueueToSpeak(t);
    await drainSpeakQueue(avatar);
    (e.currentTarget.querySelector('input[name="say"]') as HTMLInputElement).value = '';
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell x HeyGen Avatar Bridge - /avatar</h1>
      <p>Status: <strong>{status}</strong></p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
          Start
        </button>
        <form onSubmit={speakManual} style={{ display: 'flex', gap: 6 }}>
          <input name="say" placeholder="Type a line for Graham to say" style={{ padding: 8, borderRadius: 6, width: 360 }} />
          <button type="submit" style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>Speak</button>
        </form>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 10 }}>
          <input type="checkbox" checked={silenceRetell} onChange={(e) => setSilenceRetell(e.target.checked)} />
          Silence Retell audio
        </label>
      </div>

      <p style={{ marginTop: 12 }}>{msg}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9', background: '#000', borderRadius: 12, marginTop: 16 }}
      />

      {/* Captions: exactly what we send to HeyGen */}
      <div
        style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 10,
          background: '#111', color: '#fff', lineHeight: 1.5, fontSize: 16, maxWidth: 860
        }}
      >
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Agent captions</div>
        {captions.length === 0 ? (
          <div style={{ opacity: 0.6 }}>…waiting for agent</div>
        ) : (
          captions.map((c, i) => (<div key={i} style={{ margin: '4px 0' }}>• {c}</div>))
        )}
      </div>

      {/* Debug panel */}
      <div style={{
        marginTop: 12,
        padding: '10px 12px',
        border: '1px solid #333',
        borderRadius: 10,
        background: '#0b0b0b',
        color: '#9ae6b4',
        maxWidth: 860,
        fontSize: 13
      }}>
        <div><b>Updates seen:</b> {updatesSeen}</div>
        <div><b>Candidate strings:</b> {candidatesCount}</div>
        <div><b>Sample:</b> <span style={{ color: '#fff' }}>{sampleText}</span></div>
      </div>
    </main>
  );
}
