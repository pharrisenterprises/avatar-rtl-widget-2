'use client';

import React, { useRef, useState } from 'react';
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

export default function AvatarPage() {
  const [status, setStatus] = useState('ready');
  const [note, setNote] = useState('');
  const videoRef = useRef(null);

  async function start() {
    try {
      setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
      const HeyGenStreamingAvatar = await loadHeygenSdk();

      // 1) session token (NOT api key)
      const tokRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const tokJson = await tokRes.json();
      const token = tokJson?.token;
      if (!token) throw new Error('Token missing from /api/heygen-token');

      // 2) streaming avatar id (e.g., "Wayne_20240711")
      const avRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const avJson = await avRes.json();
      const avatarName = avJson?.id;
      if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

      // make visible for quick checks
      window.__HEYGEN_DEBUG__ = { token, avatarName };

      setStatus('starting'); setNote(`Starting ${avatarName}…`);
      const client = new HeyGenStreamingAvatar({ token }); // session token
      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        version: 'v3',
      });

      const videoEl = videoRef.current;
      if (!videoEl) throw new Error('Missing <video>');

      // attach API differences across builds → try them in order
      if (typeof session?.attachToElement === 'function') {
        await session.attachToElement(videoEl);
      } else if (typeof client?.attachToElement === 'function') {
        await client.attachToElement(videoEl);
      } else if (session?.mediaStream) {
        videoEl.srcObject = session.mediaStream;
        await videoEl.play();
      } else {
        throw new Error('No attach function or MediaStream available');
      }

      setStatus('started'); setNote('Streaming!');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setNote(err?.message || 'start failed');
      alert(err?.message || 'Start failed');
    }
  }

  return (
    <div style={{ padding: 20, color: '#fff', background: '#111', minHeight: '100vh', fontFamily: 'system-ui,sans-serif' }}>
      <h1>Avatar Debug (/avatar)</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>{note}</p>

      <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, background: '#1e90ff', border: '1px solid #1e90ff', color: '#fff', cursor: 'pointer' }}>
        Start
      </button>

      <div style={{ marginTop: 20, width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}
