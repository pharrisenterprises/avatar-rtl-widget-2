'use client';
import { useRef, useState } from 'react';
import { StreamingAvatar, StreamingEvents, TaskType, AvatarQuality } from '@heygen/streaming-avatar';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('Click Start to test the avatar. (v2)');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  async function start() {
    try {
      setStatus('loading');
      setMsg('Requesting HeyGen session token… (v2)');

      // ONLY talks to /api/heygen-token
      const res = await fetch('/api/heygen-token', { method: 'POST' });
      if (!res.ok) throw new Error(`Token API ${res.status}`);
      const { token } = await res.json();

      setMsg('Starting avatar session… (v2)');
      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      await a.createStartAvatar({
        quality: AvatarQuality.High,
      });

      setAvatar(a);
      setStatus('ok');
      setMsg('Connected! Speaking a test line… (v2)');

      await a.speak({ text: 'Hello! Your streaming avatar is working.', task_type: TaskType.REPEAT });

    } catch (e: any) {
      setStatus('error');
      setMsg(`Error (v2): ${e?.message || e}`);
      console.error(e);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Avatar Start Test — v2</h1>
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

