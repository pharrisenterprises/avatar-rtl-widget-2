'use client';
import React, { useRef, useState } from 'react';
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

export default function AvatarDebug() {
  const [status, setStatus] = useState('ready');
  const [note, setNote] = useState('');
  const videoRef = useRef(null);

  async function start() {
    try {
      setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
      const HeyGenStreamingAvatar = await loadHeygenSdk();

      // GET instead of POST (your route supports both now)
      const tokRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const { token } = await tokRes.json();
      if (!token) throw new Error('Session token missing from /api/heygen-token');

      const avRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const { id: avatarName } = await avRes.json();
      if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

      window.__HEYGEN_DEBUG__ = { token, avatarName };

      setStatus('starting'); setNote(`Starting ${avatarName}…`);
      const client  = new HeyGenStreamingAvatar({ token });      // ← session token
      await client.createStartAvatar({ avatarName, quality: 'high', version: 'v3' });

      if (!videoRef.current) throw new Error('Missing <video> element');
      await client.attachToElement(videoRef.current);

      setStatus('started'); setNote('Streaming!');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setNote(err?.message || 'start failed');
      alert(err?.message || 'Start failed');
    }
  }

  return (
    <div style={{ padding: 20, color: '#fff', background: '#111', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Avatar Debug (/avatar)</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>{note}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={start} style={btnPrimary}>Start</button>
      </div>
      <div style={{ marginTop: 20, position: 'relative', width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12 }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

const btnBase    = { padding: '10px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid transparent' };
const btnPrimary = { ...btnBase, background: '#1e90ff', borderColor: '#1e90ff', color: '#fff' };
