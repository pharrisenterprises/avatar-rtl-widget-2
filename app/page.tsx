'use client';

import { useEffect, useRef, useState } from 'react';
import RetellWebClient from 'retell-client-js-sdk';
import {
  StreamingAvatar,
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

/**
 * This page:
 * 1) Starts a Retell web call (handles the live conversation)
 * 2) Starts a HeyGen Streaming Avatar (renders the face/voice in video)
 * 3) When Retell finishes an utterance, sends that text to HeyGen with TaskType.REPEAT
 *    so the avatar speaks/lip-syncs using HeyGen TTS (correct HeyGen pattern).
 */

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);
  const [retell, setRetell] = useState<RetellWebClient | null>(null);

  // Simple queue to avoid overlapping avatar.speak calls
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

      // 1) Create Retell web call -> get access_token
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error(`Retell API ${retellRes.status}`);
      const { access_token } = await retellRes.json();

      // 2) Start Retell web call in browser
      const retellClient = new RetellWebClient();
      await retellClient.startCall({ accessToken: access_token });
      setRetell(retellClient);

      // Subscribe to Retell events:
      // 'update' gives running transcripts; 'agent_stop_talking' tells us an utterance just finished.
      retellClient.on('update', (evt: any) => {
        // evt contains streaming updates; you can inspect or display if needed.
        // We purposely don't push partials to the avatar to keep speech natural.
      });

      retellClient.on('agent_stop_talking', (evt: any) => {
        // evt may contain finalized text; if not, we can also keep a buffer in 'update'.
        // Here we’ll try to read 'evt.text' or similar. If your SDK emits a different shape,
        // replace with the field that holds the final agent sentence.
        const finalText = evt?.text || evt?.transcript || '';
        if (finalText && avatar) {
          speakQueueRef.current.push(finalText);
          drainSpeakQueue(avatar);
        }
      });

      setMsg('Starting HeyGen avatar session…');

      // 3) Create HeyGen Streaming session token
      const tokenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!tokenRes.ok) throw new Error(`HeyGen token API ${tokenRes.status}`);
      const { token } = await tokenRes.json();

      // 4) Init HeyGen avatar
      const a = new StreamingAvatar({ token });

      // Attach remote stream to <video>
      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      // Pick your voice & avatar. (Voice is on HeyGen side; Retell’s audio does NOT drive lips.)
      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';

      await a.createStartAvatar({
        quality: AvatarQuality.High,
        // lock your voice (male AU) and avatar name
        ...(voiceId ? { voice: { voiceId } } : {}),
        ...(avatarName ? { avatarName } : {}),
      });

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Speak to Retell; avatar will mirror agent replies.');

      // Optional: short greeting so you can see avatar speak immediately
      speakQueueRef.current.push('Hello, I am ready to assist you.');
      drainSpeakQueue(a);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg(`Error: ${e?.message || e}`);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell ↔ HeyGen Avatar Bridge</h1>
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
          maxWidth: 800,
          aspectRatio: '16/9',
          background: '#000',
          borderRadius: 12,
          marginTop: 16,
        }}
      />
    </main>
  );
}
