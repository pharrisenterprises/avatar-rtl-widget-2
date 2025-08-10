'use client';

import { useState, useRef } from 'react';
import StreamingAvatar, {
  StreamingEvents,
  AvatarQuality,
  TaskType
} from '@heygen/streaming-avatar';

export default function AvatarPage() {
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('Click Start to init chat + avatar.');
  const [chatId, setChatId] = useState<string>('');
  const [captions, setCaptions] = useState<string[]>([]);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // simple speak queue so lines do not overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  function enqueueToSpeak(text: string) {
    const t = (text || '').trim();
    if (!t) return;
    speakQueueRef.current.push(t);
    drainSpeakQueue().catch(() => {});
  }

  async function drainSpeakQueue() {
    const a = avatarRef.current;
    if (!a) return;
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length) {
        const next = speakQueueRef.current.shift();
        if (!next) continue;
        await a.speak({ text: next, task_type: TaskType.REPEAT } as any);
        setCaptions((prev) => [...prev.slice(-10), next]);
      }
    } finally {
      speakingRef.current = false;
    }
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Starting Retell chat session…');

      // 1) start a retell CHAT session (no audio)
      const r1 = await fetch('/api/retell-chat/start', { method: 'POST' });
      if (!r1.ok) throw new Error('Chat start failed');
      const { chat_id } = await r1.json();
      setChatId(chat_id);

      // 2) get heygen token and start avatar
      setMsg('Starting HeyGen avatar…');
      const r2 = await fetch('/api/heygen-token', { method: 'POST' });
      if (!r2.ok) throw new Error('HeyGen token failed');
      const { token } = await r2.json();

      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = false;
          videoRef.current.volume = 1;
          videoRef.current.play().catch(() => {});
        }
      });

      // use your already-set public env vars
      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';

      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      avatarRef.current = a;

      setStatus('ready');
      setMsg('Live! Type in the Chat box; Graham will speak the agent’s reply.');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  async function sendChat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!chatId || !avatarRef.current) return;

    const fd = new FormData(e.currentTarget);
    const userText = String(fd.get('chat') || '').trim();
    if (!userText) return;

    // send user text to retell chat agent
    const r = await fetch('/api/retell-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, content: userText })
    });

    const data = await r.json();
    const agentText = (data?.text || '').trim();

    if (agentText) {
      enqueueToSpeak(agentText);            // HeyGen speaks it
      await drainSpeakQueue();              // ensure it runs now
    }

    // clear input
    (e.currentTarget.querySelector('input[name="chat"]') as HTMLInputElement).value = '';
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Graham — Retell Chat → HeyGen Avatar</h1>
      <p>Status: <b>{status}</b></p>
      <p>{msg}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
          Start
        </button>

        <form onSubmit={sendChat} style={{ display: 'flex', gap: 6 }}>
          <input
            name="chat"
            placeholder="Type a message for the agent"
            style={{ padding: 8, borderRadius: 6, width: 360 }}
          />
          <button type="submit" style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
            Send
          </button>
        </form>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9', background: '#000', borderRadius: 12 }}
      />

      {/* captions – exactly what we send to HeyGen */}
      <div
        style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 10,
          background: '#111', color: '#fff', lineHeight: 1.5, fontSize: 16, maxWidth: 860
        }}
      >
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Agent captions</div>
        {captions.length === 0 ? (
          <div style={{ opacity: 0.6 }}>…waiting</div>
        ) : (
          captions.map((c, i) => (<div key={i} style={{ margin: '4px 0' }}>• {c}</div>))
        )}
      </div>
    </main>
  );
}
