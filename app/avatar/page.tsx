'use client';

import { useEffect, useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';
type TranscriptItem = { role?: string; speaker?: string; source?: string; who?: string; text?: string; transcript?: string; content?: string; message?: string };

export default function AvatarBridge() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);

  // Rolling full text of the current agent turn.
  const agentFullRef = useRef<string>('');
  // Char index in agentFullRef we've already spoken up to.
  const spokenIdxRef = useRef<number>(0);
  // Debounce timer to flush tail when no punctuation.
  const idleTimerRef = useRef<number | null>(null);

  // Speak queue to avoid overlaps
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // ---------- Mute everything except our HeyGen <video> ----------
  function hardMuteNonAvatarMedia() {
    const av = videoRef.current;
    const medias = document.querySelectorAll('audio, video');
    medias.forEach((el) => {
      const m = el as HTMLMediaElement;
      if (av && m === av) {
        // keep HeyGen audible
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

  // ---------- HeyGen speaking helpers ----------
  async function safeSpeak(a: StreamingAvatar, text: string) {
    const t = text.trim();
    if (!t) return;
    try {
      console.log('[HeyGen] speak ->', t);
      await a.speak({ text: t, task_type: TaskType.REPEAT } as any);
      setCaptions(prev => [...prev.slice(-10), t]);
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
    if (!text.trim()) return;
    speakQueueRef.current.push(text.trim());
    if (avatar) void drainSpeakQueue(avatar);
  }

  // ---------- Retell transcript handling (sentence-based) ----------
  function isUserRole(x: any): boolean {
    const role = (x?.role || x?.speaker || x?.source || x?.who || '').toString().toLowerCase();
    return role.includes('user');
  }
  function extractText(x: any): string | null {
    const t = x?.text ?? x?.transcript ?? x?.content ?? x?.message ?? null;
    return typeof t === 'string' && t.trim() ? t.trim() : null;
  }
  function handleTranscriptUpdate(update: any) {
    const arr = Array.isArray(update?.transcript) ? (update.transcript as TranscriptItem[]) : [];
    if (!arr.length) return;

    // Build the latest AGENT-only full string from this rolling window
    const agentLines = arr
      .filter(item => !isUserRole(item))
      .map(item => extractText(item))
      .filter((t): t is string => !!t);

    const full = agentLines.join(' ').replace(/\s+/g, ' ').trim();
    if (!full) return;

    agentFullRef.current = full;

    // Debounce flush: if no new updates in 1200ms, we’ll flush leftover tail
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      tryFlushTail(true);
    }, 1200);

    // Try to flush any newly completed sentences now
    tryFlushTail(false);
  }

  // Split into sentences that end with punctuation; leave a tail if not ended
  function splitCompletedSince(lastIdx: number, full: string) {
    const newChunk = full.slice(lastIdx);
    if (!newChunk) return { completed: [] as string[], consumed: 0 };

    // Find sentences ending in . ! ? … (with optional quotes)
    const regex = /[^.!?…]+[.!?…]+["')]*\s*/g;
    const completed: string[] = [];
    let consumed = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(newChunk)) !== null) {
      completed.push(match[0].trim());
      consumed = match.index + match[0].length;
    }
    return { completed, consumed };
  }

  function tryFlushTail(forceFinal: boolean) {
    const full = agentFullRef.current;
    const last = spokenIdxRef.current;

    if (full.length <= last) return;

    const { completed, consumed } = splitCompletedSince(last, full);

    // Speak any newly completed sentences
    if (completed.length > 0) {
      spokenIdxRef.current = last + consumed;
      completed.forEach(s => enqueueToSpeak(s));
    }

    // If forcing (idle pause) and there is leftover tail without punctuation, speak it once
    if (forceFinal && spokenIdxRef.current < full.length) {
      const tail = full.slice(spokenIdxRef.current).trim();
      if (tail) {
        spokenIdxRef.current = full.length;
        enqueueToSpeak(tail);
      }
    }
  }

  // ---------- Start flow ----------
  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // Retell web call
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      const retell = new RetellWebClient();
      await retell.startCall({ accessToken: access_token });
      console.log('[Retell] call started');

      hardMuteNonAvatarMedia(); // immediately mute any Retell audio elements

      // Listen for live rolling transcript
      retell.on?.('update', (u: any) => {
        // console.log('[Retell] update', u);
        try { handleTranscriptUpdate(u); } catch (e) { console.error('[Bridge] parse update failed', e); }
      });
      retell.on?.('agent_start_talking', (e: any) => console.log('[Retell] agent_start_talking'));
      retell.on?.('agent_stop_talking', (e: any) => {
        console.log('[Retell] agent_stop_talking');
        // On stop, immediately flush any leftover tail
        tryFlushTail(true);
      });
      retell.on?.('error', (e: any) => console.error('[Retell] error', e));

      // HeyGen
      const heygenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!heygenRes.ok) throw new Error('HeyGen token failed: ' + heygenRes.status);
      const { token } = await heygenRes.json();

      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = false; // we want HeyGen audio
          videoRef.current.play().catch(() => {});
        }
        console.log('[HeyGen] stream ready');
        hardMuteNonAvatarMedia(); // keep Retell muted even if new tags appear
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || ''; // e.g. Graham_Chair_Sitting_public

      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      console.log('[HeyGen] avatar session started', opts);

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Avatar mirrors the agent. (Sentences only, no repeats)');

      // Say a short hello so you confirm audio/lips
      enqueueToSpeak('Link is live. I will now mirror the agent without repeating.');
      void drainSpeakQueue(a);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  // Manual sanity button optional (kept for testing)
  async function sayTest() {
    if (!avatar) return;
    enqueueToSpeak('Manual test line. You should both hear me and see my mouth move.');
    await drainSpeakQueue(avatar);
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell x HeyGen Avatar Bridge - /avatar</h1>
      <p>Status: <strong>{status}</strong></p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>Start</button>
        <button onClick={sayTest} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>Say test line</button>
      </div>
      <p style={{ marginTop: 12 }}>{msg}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9', background: '#000', borderRadius: 12, marginTop: 16 }}
      />

      {/* Captions (exact chunks sent to HeyGen) */}
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
    </main>
  );
}
