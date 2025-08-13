'use client';

import React, { useRef, useState } from 'react';
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

export default function AvatarDebug() {
  const [status, setStatus] = useState('ready');
  const [note, setNote] = useState('');
  const videoRef = useRef(null);

  async function start() {
    try {
      setStatus('loading-sdk');
      setNote('Loading HeyGen SDK…');
      const HeyGenStreamingAvatar = await loadHeygenSdk();

      // 1) session token (NOT api key)
      const tokRes = await fetch('/api/heygen-token', { cache: 'no-store', method: 'GET' });
      if (!tokRes.ok) throw new Error('GET /api/heygen-token failed: ' + tokRes.status);
      const tokJson = await tokRes.json();
      const token = tokJson?.token;
      if (!token) throw new Error('Token missing from /api/heygen-token');

      // 2) streaming avatar id (name string, e.g. "Wayne_20240711")
      const avRes = await fetch('/api/heygen-avatars', { cache: 'no-store', method: 'GET' });
      if (!avRes.ok) throw new Error('GET /api/heygen-avatars failed: ' + avRes.status);
      const avJson = await avRes.json();
      const avatarName = avJson?.id;
      if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

      window.__HEYGEN_DEBUG__ = { token, avatarName };

      setStatus('starting');
      setNote(`Starting avatar ${avatarName}…`);

      // 3) start the avatar session (v3+)
      const client = new HeyGenStreamingAvatar({ token }); // session token
      const session = await client.createStartAvatar({
        avatarName,          // "Wayne_20240711"
        quality: 'high',
        version: 'v3'
      });

      // 4) attach to <video>
      if (!videoRef.current) throw new Error('Missing <video> element');
      await client.attachToElement(videoRef.current);

      setStatus('started');
      setNote('Streaming!');
    } catch (err) {
      console.error(err);
      setStatus('error');
      const msg = err?.message || 'start failed';
      setNote(msg);
      alert(msg);
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

      <div style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
        After Start, <code>window.__HEYGEN_DEBUG__</code> contains <code>{`{ token, avatarName }`}</code>.
      </div>

      <div style={{ marginTop: 20, position: 'relative', width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

const btnBase = {
  padding: '10px 16px',
  borderRadius: 8,
  cursor: 'pointer',
  border: '1px solid transparent'
};

const btnPrimary = {
  ...btnBase,
  background: '#1e90ff',
  borderColor: '#1e90ff',
  color: '#fff'
};
