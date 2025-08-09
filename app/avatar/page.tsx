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
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  // Captions (finalized agent lines)
  const [captions, setCaptions] = useState<string[]>([]);
  // Buffer we fill from Retell streaming updates
  const agentBufferRef = useRef<string>('');

  // Queue so avatar lines don't overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  async function drainSpeakQueue(a: StreamingAvatar) {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length > 0) {
        const text = speakQueueRef.current.shift();
        if (!text) break;
        console.log('[HeyGen] speak:', text);
        await a.speak({ text, task_type: TaskType.REPEAT });
        setCaptions(prev => [...prev.slice(-8), text]);
      }
    } finally {
      speakingRef.current = false;
    }
  }

  function extractAgentTextFromUpdate(evt: any): string | null {
    // Retell SDKs can emit slightly different shapes; try common fields.
    // Only collect agent text (not user).
    const role = evt?.role || evt?.speaker || evt?.source || evt?.who;
    const isUser = role && String(role).toLowerCase().includes('user');
    if (isUser) return null;

    const text =
      evt?.text ??
      evt?.transcript ??
      evt?.content ??
      evt?.message ??
      null;

    if (typeof text === 'string' && text.trim()) return text.trim();
    return null;
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // 1) Start Retell
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      const retell = new RetellWebClient();
      await retell.startCall({ accessToken: access_token });
      console.log('[Retell] call started');

      // Streaming updates to build buffer
      retell.on?.('update', (evt: any) => {
        const t = extractAgentTextFromUpdate(evt);
        if (t) {
          agentBufferRef.current = (agentBufferRef.current + ' ' + t).slice(-800);
          // console.log('[Retell] update+agent:', t);
        }
      });

      // When agent finishes a sentence/turn -> send to avatar
      retell.on?.('agent_stop_talking', (evt: any) => {
        const finalText =
          evt?.text ||
          evt?.transcript ||
          agentBufferRef.current.trim();

        agentBufferRef.current = '';

        if (finalText && avatar) {
          speakQueueRef.current.push(finalText);
          void drainSpeakQueue(avatar);
        }
        console.log('[Retell] agent_stop_talking ->', finalText);
      });

      // 2) Start HeyGen
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

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';           // AU male "Shawn"
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';     // e.g. Graham_Chair_Sitting_public

      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      console.log('[HeyGen] avatar session started');

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Speak to the agent; avatar mirrors agent replies.');

      // Optional greeting so you see lips move at least once immediately
      speakQueueRef.current.push('Hello, I am ready to assist you.');
      void drainSpeakQueue(a);
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell x HeyGen Avatar Bridge - /avatar</h1>
      <p>Status: <strong>{status}</strong></p>
      <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
        Start
      </button>
      <p style={{ marginTop: 12 }}>{msg}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9', background: '#000', borderRadius: 12, marginTop: 16 }}
      />

      {/* Captions */}
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
