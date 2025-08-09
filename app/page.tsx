'use client';
import { useEffect, useRef, useState } from 'react';
import { StreamingAvatar, StreamingEvents, TaskType, AvatarQuality } from '@heygen/streaming-avatar';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('Click Start to test the avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  async function start() {
    try {
      setStatus('loading');
      setMsg('Requesting HeyGen session token…');

      // 1) ask our backend for a short-lived token
      const res = await fetch('/api/heygen-token', { method: 'POST' });
      if (!res.ok) throw new Error(`Token API ${res.status}`);
      const { token } = await res.json();

      setMsg('Starting avatar session…');

      // 2) create the avatar client with the token
      const a = new StreamingAvatar({ token });

      // When the stream is ready, attach it to the <video>
      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      // 3) create+start a session (defaults are fine for testing)
      await a.createStartAvatar({
        quality: AvatarQuality.High,        // 720p
        // avatarName: 'default',           // optional; uses default avatar
        // voice: { voiceId: '...' },       // optional; you can set later if you want
        // language: 'en',                   // optional
      });

      setAvatar(a);
      setStatus('ok');
      setMsg('Connected! I’m about to say a test line…');

      // 4) say a test line
      await a.speak({ text: 'Hello! Your streaming avatar is working.', task_type: TaskType.REPEAT });

    } catch (e: any) {
      setStatus('error');
      setMsg(`Error: ${e?.message || e}`);
      console.error(e);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Avatar Start Test</h1>
      <p>Status: <b>{status}</b></p>
      <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
        Start
      </button>
      <p style={{ marginTop: 12 }}>{msg}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 720, aspectRatio: '16/9', background: '#000', borderRadius: 12, marginTop: 16 }}
      />

      <div style={{ marginTop: 24 }}>
        <a href="/diagnostics">Go to diagnostics</a>
      </div>
    </main>
  );
}

