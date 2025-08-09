'use client';

import { useEffect, useRef, useState } from 'react';
import { StreamingAvatar, TaskType } from '@heygen/streaming-avatar';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  async function start() {
    if (active) return;
    setActive(true);

    // 1) Get a one-time streaming token from our server
    const tokResp = await fetch('/api/heygen-token', { method: 'POST' });
    const tokJson = await tokResp.json();
    const token = tokJson?.data?.token;
    if (!token) {
      alert('Could not get HeyGen token');
      setActive(false);
      return;
    }

    // 2) Create the Streaming Avatar client
    const avatar = new StreamingAvatar({ token });
    avatarRef.current = avatar;

    // 3) Hook the video track to our <video>
    avatar.on('videoTrack', (track: MediaStreamTrack) => {
      if (!videoRef.current) return;
      const ms = new MediaStream([track]);
      videoRef.current.srcObject = ms;
      videoRef.current.play().catch(() => {});
    });

    // 4) Start a fresh session (SDK wraps the streaming.new + start bits)
    const session = await avatar.createStartAvatar({
      // quality: 'high', // optional; defaults OK. See docs.
      // You can pass an avatar id/voice later; for now use defaults so we just connect.
    });
    setSessionId(session.session_id);

    // 5) Say one test line so you can verify audio/video
    await avatar.speak({
      sessionId: session.session_id,
      text: "Hi! Your HeyGen avatar is connected.",
      task_type: TaskType.REPEAT
    });
  }

  async function stop() {
    setActive(false);
    try { await avatarRef.current?.stopAvatar({ sessionId: sessionId! }); } catch {}
    try { await avatarRef.current?.disconnect(); } catch {}
    avatarRef.current = null;
    setSessionId(null);

    // Clear the video element
    if (videoRef.current) {
      const src = videoRef.current.srcObject as MediaStream | null;
      src?.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
  }

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',gap:16,fontFamily:'system-ui'}}>
      <video ref={videoRef} autoPlay playsInline muted={false}
             style={{width:360,height:640,borderRadius:16,background:'#000'}} />
      <div style={{display:'flex',gap:12}}>
        <button onClick={start} disabled={active} style={{padding:'10px 16px'}}>Start</button>
        <button onClick={stop} disabled={!active} style={{padding:'10px 16px'}}>Stop</button>
      </div>
    </main>
  );
}
