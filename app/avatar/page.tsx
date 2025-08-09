'use client';

import { useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';

export default function AvatarBridge() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  const [captions, setCaptions] = useState<string[]>([]);
  const agentBufferRef = useRef<string>('');
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  async function safeSpeak(a: StreamingAvatar, text: string) {
    try {
      console.log('[HeyGen] speak() try:', text);
      // task_type: 'repeat' (mirror our text); taskMode 'sync' for simpler flow
      await a.speak({ text, task_type: 'repeat', taskMode: 'sync' } as any);
      setCaptions(prev => [...prev.slice(-8), text]);
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

  function extractAgentTextFromUpdate(evt: any): string | null {
    const role = evt?.role || evt?.speaker || evt?.source || evt?.who;
    if (role && String(role).toLowerCase().includes('user')) return null;
    const text = evt?.text ?? evt?.transcript ?? evt?.content ?? evt?.message ?? null;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // 1) Retell
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      const retell = new RetellWebClient();
      await retell.startCall({ accessToken: access_token });
      console.log('[Retell] call started');

      retell.on?.('update', (evt: any) => {
        const t = extractAgentTextFromUpdate(evt);
        if (t) agentBufferRef.current = (agentBufferRef.current + ' ' + t).slice(-800);
      });

      retell.on?.('agent_stop_talking', (evt: any) => {
        const finalText = evt?.text || evt?.transcript || agentBufferRef.current.trim();
        agentBufferRef.current = '';
        console.log('[Retell] agent_stop_talking:', finalText);
        if (finalText && avatar) {
          speakQueueRef.current.push(finalText);
          void drainSpeakQueue(avatar);
        }
      });

      // 2) HeyGen
      const heygenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!heygenRes.ok) throw new Error('HeyGen token failed: ' + heygenRes.status);
      const { token } = await heygenRes.json();

      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        console.log('[HeyGen] stream ready');
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || ''; // e.g. Graham_Chair_Sitting_public

      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      console.log('[HeyGen] avatar session started with', opts);
      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Speak to the agent; avatar mirrors agent replies.');

      // FORCE a test line so we see lips move even before Retell
      await safeSpeak(a, 'Testing lip sync. One two three.');

    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  async function sayTest() {
    if (!avatar) return;
    await safeSpeak(avatar, 'This is a manual test line. The avatar should move its lips now.');
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell x HeyGen Avatar Bridge - /avatar</h1>
      <p>Status: <strong>{status}</strong></p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
          Start
        </button>
        <button onClick={sayTest} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
          Say test line
        </button>
      </div>
      <p style={{ marginTop: 12 }}>{msg}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9', background: '#000', borderRadius: 12, marginTop: 16 }}
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
    </main>
  );
}
