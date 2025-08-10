'use client';

import { useState, useRef } from 'react';
import { StreamingAvatar, StreamingEvents, AvatarQuality } from '@heygen/streaming-avatar';

export default function AvatarPage() {
  const [avatar, setAvatar] = useState<any>(null);
  const [status, setStatus] = useState<string>('idle');
  const [msg, setMsg] = useState<string>('');
  const [chatId, setChatId] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Queue system so HeyGen speaks one thing at a time
  const speakQueue: string[] = [];
  function enqueueToSpeak(text: string) {
    speakQueue.push(text);
  }
  async function drainSpeakQueue(a: any) {
    while (speakQueue.length > 0) {
      const text = speakQueue.shift();
      if (!text) continue;
      await a.speak({ text });
    }
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Starting chat + avatar...');

      // 1) Start Retell Chat
      const r1 = await fetch('/api/retell-chat/start', { method: 'POST' });
      if (!r1.ok) throw new Error('Chat start failed');
      const { chat_id } = await r1.json();
      setChatId(chat_id);

      // 2) Start HeyGen
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

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Type to chat; Graham will speak the agent’s replies.');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  async function chatSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!avatar || !chatId) return;
    const fd = new FormData(e.currentTarget);
    const userText = String(fd.get('chat') || '').trim();
    if (!userText) return;

    const r = await fetch('/api/retell-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, content: userText })
    });
    const data = await r.json();
    const agentText = (data?.text || '').trim();
    if (agentText) {
      enqueueToSpeak(agentText);
      if (avatar) await drainSpeakQueue(avatar);
    }

    (e.currentTarget.querySelector('input[name="chat"]') as HTMLInputElement).value = '';
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Graham – Retell Chat via HeyGen</h1>
      <p>Status: {status}</p>
      <p>{msg}</p>

      <div style={{ marginBottom: 10 }}>
        <button onClick={start} style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
          Start
        </button>
      </div>

      <form onSubmit={chatSend} style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          name="chat"
          placeholder="Type a message for the agent"
          style={{ padding: 8, borderRadius: 6, width: 360 }}
        />
        <button type="submit" style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
          Send
        </button>
      </form>

      <video ref={videoRef} autoPlay playsInline style={{ width: 640, height: 480, background: '#000' }} />
    </div>
  );
}
