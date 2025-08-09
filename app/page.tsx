'use client';

import { useRef, useState } from 'react';
import { StreamingAvatar, StreamingEvents, TaskType, AvatarQuality } from '@heygen/streaming-avatar';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('Click Start to test the avatar. (v3)');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  async function start() {
    try {
      setStatus('loading');
      setMsg('Requesting HeyGen session token… (v3)');

      // Call ONLY our token route
      const res = await fetch('/api/heygen-token', { method: 'POST' });
      if (!res.ok) throw new Error(`Token API ${res.status}`);
      const { token } = await res.json();

      setMsg('Starting avatar session… (v3)');
      const a = new StreamingAvatar({ token });

      // Attach the media stream to the <video>
      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Some browsers require play() after setting srcObject
          videoRef.current.play().catch(() => {});
        }
      });

      // Start the avatar (defaults are fine for a first test)
      await a.createStartAvatar({
        quality: AvatarQuality.High,
        // You can pin an avatar/voice later with:
        // avatarName: 'default',
        // voice: { voiceId: 'YOUR_VOICE_ID' },
      });

      setAvatar(a);
      setStatus('ok');
      setMsg('Connected! Speaking a test line… (v3)');

      // Say a quick test line
      await a.speak({ text: 'Hello! Your streaming avatar is working.', task_type: TaskType.REPEAT });
    } catch (e: any) {
      setStatus('error');
      setMsg(`Error (v3): ${e?.message || e}`);
      console.error(e);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Avatar Start Test — v3</h1>
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
