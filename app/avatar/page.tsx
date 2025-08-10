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

  // dedupe: last full agent line we sent to HeyGen
  const lastAgentLineRef = useRef<string>('');
  // queue so HeyGen lines don’t overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // ---------- Retell audio silencer ----------
  // Mute any <audio> elements Retell creates, now and in the future.
  function hardMuteAllAudioTags() {
    const audios = document.querySelectorAll('audio');
    audios.forEach((a: HTMLAudioElement) => {
      try {
        a.muted = true;
        a.volume = 0;
      } catch {}
    });
  }
  useEffect(() => {
    // catch future audio elements too
    const mo = new MutationObserver(() => hardMuteAllAudioTags());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // ---------- HeyGen speak helpers ----------
  async function safeSpeak(a: StreamingAvatar, text: string) {
    const t = text?.trim();
    if (!t) return;
    try {
      console.log('[HeyGen] speak() try:', t);
      await a.speak({ text: t, task_type: TaskType.REPEAT } as any);
      setCaptions(prev => [...prev.slice(-8), t]);
      console.log('[HeyGen] speak() ok');
    } catch (err) {
      console.error('[HeyGen] speak() failed:', err);
      setMsg('Error: speak() failed. See console.');
    }
  }
  async function drainSpeakQueue(a: StreamingAvatar) {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length > 0) {
        const text = speakQueueRef.current.shift();
        if (!text) break;
        await safeSpeak(a, text);
      }
    } finally {
      speakingRef.current = false;
    }
  }
  function enqueueOnce(line: string) {
    const t = line.trim();
    if (!t || t === lastAgentLineRef.current) return;
    lastAgentLineRef.current = t;
    console.log('[Bridge] enqueue:', t);
    speakQueueRef.current.push(t);
    if (avatar) void drainSpeakQueue(avatar);
  }

  // ---------- Retell transcript extraction ----------
  function extractText(x: any): string | null {
    // ignore user lines
    const roleRaw = (x?.role || x?.speaker || x?.source || x?.who || '').toString().toLowerCase();
    if (roleRaw.includes('user')) return null;
    const text = x?.text ?? x?.transcript ?? x?.content ?? x?.message ?? null;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  }
  function handleTranscriptUpdate(update: any) {
    const arr = Array.isArray(update?.transcript) ? (update.transcript as TranscriptItem[]) : [];
    if (!arr.length) return;
    // Take the latest non-user sentence
    for (let i = arr.length - 1; i >= 0; i--) {
      const maybe = extractText(arr[i]);
      if (maybe) {
        enqueueOnce(maybe);
        break;
      }
    }
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // 1) Retell web call (per docs: startCall + listen "update" for transcript)
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      const retell = new RetellWebClient();
      await retell.startCall({
        accessToken: access_token,
        // If Retell ever exposes a playback toggle, we’ll set it here.
        // For now we hard-mute any audio tags they attach.
      });
      console.log('[Retell] call started');

      // Make *extra sure* Retell audio is silenced on Start
      hardMuteAllAudioTags();

      // Live transcript updates (doc says it’s on `update.transcript`)
      retell.on?.('update', (u: any) => {
        console.log('[Retell] update', u);
        try { handleTranscriptUpdate(u); } catch (e) { console.error('[Bridge] parse update failed', e); }
      });
      retell.on?.('agent_start_talking', (e: any) => console.log('[Retell] agent_start_talking', e));
      retell.on?.('agent_stop_talking', (e: any) => console.log('[Retell] agent_stop_talking', e));
      retell.on?.('error', (e: any) => console.error('[Retell] error', e));

      // 2) HeyGen avatar
      const heygenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!heygenRes.ok) throw new Error('HeyGen token failed: ' + heygenRes.status);
      const { token } = await heygenRes.json();

      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = false; // we WANT to hear HeyGen
          videoRef.current.play().catch(() => {});
        }
        console.log('[HeyGen] stream ready');
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';      // Shawn AU
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || ''; // e.g. Graham_Chair_Sitting_public

      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      console.log('[HeyGen] avatar session started with', opts);

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! The avatar will mirror Retell replies.');

      // Drain anything that arrived before avatar came up
      void drainSpeakQueue(a);

      // Quick audible confirmation from HeyGen
      await safeSpeak(a, 'Lip sync link is live. I will mirror the agent.');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  async function sayTest() {
    if (!avatar) return;
    await safeSpeak(avatar, 'Manual test line. Do you both hear me and see my mouth move?');
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

      {/* Captions (what we send to HeyGen) */}
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
