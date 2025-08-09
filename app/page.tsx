'use client';

import { useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  async function drainSpeakQueue(a: StreamingAvatar) {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length > 0) {
        const text = speakQueueRef.current.shift();
        if (!text) break;
        await a.speak({ text, task_type: TaskType.REPEAT });
      }
    } finally {
      speakingRef.current = false;
    }
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Creating Retell web call…');

      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error(`Retell API ${retellRes.status}`);
      const { access_token } = await retellRes.json();

      const retellClient = new RetellWebClient();
      await retellClient.startCall({ accessToken: access_token });

      retellClient.on?.('agent_stop_talking', (evt: any) => {
        const finalText = evt?.text || evt?.transcript || '';
        if (finalText && avatar) {
          speakQueueRef.current.push(finalText);
          void drainSpeakQueue(avatar);
        }
      });

      setMsg('Starting HeyGen avatar session…');

      const tokenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!tokenRes.ok) throw new Error(`HeyGen token API ${tokenRes.status}`);
      const { token } = await tokenRes.json();

      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';

      await a.createStartAvatar({
        quality: AvatarQuality.High,
        ...(voiceId ? { voice: { voiceId } } : {}),
        ...(avatarName ? { avatarName } : {}),
      });

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Speak to Retell; avatar mirrors agent replies.');
      speakQueueRef.current.push('Hello, I am ready to assist you.');
      void drainSpeakQueue(a);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg(`Error: ${e?.message || e}`);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell ↔ HeyGen Avatar Bridge (root)</h1>
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
        style={{
          width: '100%',
          maxWidth: 860,
          aspectRatio: '16/9',
          background: '#000',
          borderRadius: 12,
          marginTop: 16
        }}
      />
      <div style={{ marginTop: 24 }}>
        <a href="/avatar">Go to /avatar version</a>
      </div>
    </main>
  );
}

