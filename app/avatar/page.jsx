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
      const HeyGenCtor = await loadHeygenSdk();

      // 1) session token
      const tRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const tJson = await tRes.json();
      const token = tJson?.token;
      if (!token) throw new Error('Token missing from /api/heygen-token');

      // 2) avatar id
      const aRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const aJson = await aRes.json();
      const avatarName = aJson?.id;
      if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

      window.__HEYGEN_DEBUG__ = { token, avatarName };

      setStatus('starting'); setNote(`Starting ${avatarName}…`);
      const client = new HeyGenCtor({ token });

      // Common API in v2: createStartAvatar({ avatarName, quality, version })
      const session = await client.createStartAvatar?.({
        avatarName, quality: 'high', version: 'v3',
      });

      // Log shapes we actually received
      console.log('[DBG] client keys:', Object.keys(client || {}));
      console.log('[DBG] session type:', typeof session, session && Object.keys(session));

      const videoEl = videoRef.current;
      if (!videoEl) throw new Error('Missing <video> element');

      // Try every known attachment shape (across SDK variants)
      if (session && typeof session.attachToElement === 'function') {
        await session.attachToElement(videoEl);
        return done();
      }
      if (typeof client.attachToElement === 'function') {
        await client.attachToElement(videoEl);
        return done();
      }

      // Direct MediaStream on session
      if (session?.mediaStream instanceof MediaStream) {
        videoEl.srcObject = session.mediaStream; await videoEl.play(); return done();
      }
      if (session?.stream instanceof MediaStream) {
        videoEl.srcObject = session.stream; await videoEl.play(); return done();
      }

      // Tracks on session
      const vt = session?.videoTrack || session?.video || session?.cameraTrack;
      const at = session?.audioTrack || session?.microphoneTrack || session?.audio;
      if (vt || at) {
        const tracks = [vt, at].filter(Boolean);
        if (tracks.length) {
          const ms = new MediaStream(tracks.map(x => (x?.track || x)));
          videoEl.srcObject = ms; await videoEl.play(); return done();
        }
      }

      // Methods that return stream
      if (typeof session?.getMediaStream === 'function') {
        const ms = await session.getMediaStream(); if (ms) { videoEl.srcObject = ms; await videoEl.play(); return done(); }
      }
      if (typeof client?.getMediaStream === 'function') {
        const ms = await client.getMediaStream(); if (ms) { videoEl.srcObject = ms; await videoEl.play(); return done(); }
      }

      // If we got here, expose shapes to console to see what’s missing
      console.log('[DBG] session dump:', session);
      console.log('[DBG] client dump:', client);
      throw new Error('No attach function or MediaStream available');

      function done() {
        setStatus('started'); setNote('Streaming!');
      }
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

      <button onClick={start} style={btn}>Start</button>

      <div style={{ marginTop: 20, width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

const btn = {
  padding: '10px 16px',
  borderRadius: 8,
  background: '#1e90ff',
  border: '1px solid #1e90ff',
  color: '#fff',
  cursor: 'pointer'
};
