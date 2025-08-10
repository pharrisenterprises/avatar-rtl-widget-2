'use client';

import { useEffect, useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';
type TranscriptItem = {
  role?: string;
  speaker?: string;
  source?: string;
  who?: string;
  text?: string;
  transcript?: string;
  content?: string;
  message?: string;
};

export default function AvatarBridge() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);
  const [debug, setDebug] = useState<string>('—');

  // rolling agent text for current turn + how much we have spoken
  const agentFullRef = useRef<string>('');
  const spokenIdxRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  // speak queue so lines do not overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // -------- Mute everything except our HeyGen <video> --------
  function hardMuteNonAvatarMedia() {
    const av = videoRef.current;
    const medias = document.querySelectorAll('audio, video');
    medias.forEach((el) => {
      const m = el as HTMLMediaElement;
      if (av && m === av) {
        m.muted = false;
        m.volume = 1;
      } else {
        try { m.muted = true; m.volume = 0; } catch {}
      }
    });
  }
  useEffect(() => {
    const mo = new MutationObserver(() => hardMuteNonAvatarMedia());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // -------- HeyGen speak helpers --------
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

  // -------- Retell transcript handling (sentence-based) --------
  function isUserRole(x: any): boolean {
    const role = (x?.role || x?.speaker || x?.source || x?.who || '').toString().toLowerCase();
    return role.includes('user');
  }
  function extractLooseText(x: any): string | null {
    const t = x?.text ?? x?.transcript ?? x?.content ?? x?.message ?? null;
    return typeof t === 'string' && t.trim() ? t.trim() : null;
  }

  function extractAgentFromUpdate(update: any): string | null {
    const seen: string[] = [];

    if (Array.isArray(update?.transcript)) {
      seen.push('transcript[]');
      const arr = update.transcript as TranscriptItem[];
      const agentLines = arr.filter((it) => !isUserRole(it)).map(extractLooseText).filter(Boolean) as string[];
      if (agentLines.length) {
        setDebug(seen.join(' -> '));
        return agentLines.join(' ').replace(/\s+/g, ' ').trim();
      }
    }
    const arContent = update?.agent_response?.content;
    if (typeof arContent === 'string' && arContent.trim()) {
      seen.push('agent_response.content');
      setDebug(seen.join(' -> '));
      return arContent.trim();
    }
    const amText = extractLooseText(update?.agent_message);
    if (amText) {
      seen.push('agent_message');
      setDebug(seen.join(' -> '));
      return amText;
    }
    const msgObj = update?.message;
    if (msgObj && (msgObj.role === 'assistant' || msgObj.role === 'agent')) {
      const mText = extractLooseText(msgObj);
      if (mText) {
        seen.push('message(role=assistant/agent)');
        setDebug(seen.join(' -> '));
        return mText;
      }
    }
    const loose = extractLooseText(update);
    if (loose) {
      seen.push('top-level(text)');
      setDebug(seen.join(' -> '));
      return loose;
    }
    setDebug('no-agent-text');
    return null;
  }

  function splitCompletedSince(lastIdx: number, full: string) {
    const newChunk = full.slice(lastIdx);
    if (!newChunk) return { completed: [] as string[], consumed: 0 };
    const regex = /[^.!?…]+[.!?…]+["')]*\s*/g;
    const completed: string[] = [];
    let consumed = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(newChunk)) !== null) {
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
    if (completed.length > 0) {
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

  function handleAnyUpdate(update: any) {
    const agentFull = extractAgentFromUpdate(update);
    if (!agentFull) return;
    const full = agentFull.replace(/\s+/g, ' ').trim();
    if (!full) return;

    agentFullRef.current = full;

    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      tryFlushTail(true);
    }, 1200);

    tryFlushTail(false);
  }

  // -------- Start flow --------
  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      const retell = new RetellWebClient();
      await retell.startCall({ accessToken: access_token });
      hardMuteNonAvatarMedia();

      retell.on?.('update', (u: any) => {
        try { handleAnyUpdate(u); } catch (e) { console.error('[Bridge] parse update failed', e); }
      });
      retell.on?.('agent_start_talking', () => {});
      retell.on?.('agent_stop_talking', () => { tryFlushTail(true); });
      retell.on?.('error', (e: any) => console.error('[Retell] error', e));

      const heygenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!heygenRes.ok) throw new Error('HeyGen token failed: ' + heygenRes.status);
      const { token } = await heygenRes.json();

      const a = new StreamingAvatar({ token });
      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = false;
          videoRef.current.play().catch(() => {});
        }
        hardMuteNonAvatarMedia();
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Avatar mirrors the agent (sentences only).');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

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
          marginTop: 16
        }}
      />

      <div
        style={{
          marginTop: 12,
          padding: '12px 14px',
          borderRadius: 10,
          background: '#111',
          color: '#fff',
          lineHeight: 1.5,
          fontSize: 16,
          maxWidth: 860
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
          opacity: 0.9
        }}
      >
        src: {debug}
      </div>
    </main>
  );
}
