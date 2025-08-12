'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadHeygenSdk } from '@/app/lib/loadHeygenSdk';

async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

export default function AvatarDebugPage() {
  const [status, setStatus] = useState('idle');   // idle | token_ok | avatar_ok | starting | started | error
  const [note, setNote]   = useState('');
  const tokenRef   = useRef('');
  const avatarRef  = useRef(''); // streaming avatar *id* like "Wayne_20240711"
  const videoRef   = useRef(null);

  // Warm up token + avatar id
  useEffect(() => {
    (async () => {
      try {
        const t = await getJSON('/api/heygen-token');
        if (!t?.token) throw new Error('Token JSON missing "token"');
        tokenRef.current = t.token;
        setStatus('token_ok');

        const a = await getJSON('/api/heygen-avatars');
        if (!a?.id) throw new Error('Avatar JSON missing "id"');
        avatarRef.current = a.id;
        setStatus('avatar_ok');
        setNote(`Ready: ${a.id}`);
      } catch (e) {
        setStatus('error');
        setNote(e.message || 'Warmup failed');
      }
    })();
  }, []);

  async function onStart() {
    try {
      setStatus('starting');
      setNote('Loading HeyGen SDK…');

      const HG = await loadHeygenSdk();
      if (!HG) throw new Error('HeyGen SDK not available');

      if (!tokenRef.current) {
        const t = await getJSON('/api/heygen-token');
        tokenRef.current = t.token;
      }
      if (!avatarRef.current) {
        const a = await getJSON('/api/heygen-avatars');
        avatarRef.current = a.id;
      }

      const token = tokenRef.current;
      const avatarName = avatarRef.current;

      if (!token || !avatarName) throw new Error('Missing token or avatar id');

      // Expose for your other pages / debugging
      window.__HEYGEN_DEBUG__ = { token, avatarName };

      // ---- Actual start sequence ----
      // The UMD exports a constructor on window.HeyGenStreamingAvatar
      const ClientCtor = window.HeyGenStreamingAvatar;
      if (!ClientCtor) throw new Error('HeyGenStreamingAvatar missing on window');

      // 1) create client with token (IMPORTANT: field is "token", not "access_token")
      const client = new ClientCtor({ token });

      // 2) start a session; avatarName must be the streaming id e.g. "Wayne_20240711"
      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high'
      });

      // 3) pipe remote stream to our <video>
      const videoEl = videoRef.current;
      if (!videoEl) throw new Error('Missing <video> element');

      const mediaStream = await client.attachToElement(videoEl);
      console.log('[heygen] attached stream', mediaStream);

      // 4) optional: quick mouth-check
      // await client.speakText('Hello! This is a quick streaming check.');

      setStatus('started');
      setNote('Avatar started (values on window.__HEYGEN_DEBUG__)');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setNote(err?.message || 'Start failed');
    }
  }

  async function testToken() {
    try {
      const t = await getJSON('/api/heygen-token');
      tokenRef.current = t.token;
      setStatus('token_ok');
      setNote('Token OK');
    } catch (e) {
      setStatus('error');
      setNote(e.message);
    }
  }

  async function testAvatar() {
    try {
      const a = await getJSON('/api/heygen-avatars');
      avatarRef.current = a.id;
      setStatus('avatar_ok');
      setNote(`Avatar OK: ${a.id}`);
    } catch (e) {
      setStatus('error');
      setNote(e.message);
    }
  }

  return (
    <div style={{ padding: 20, color: '#fff', background: '#111', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Avatar Debug (/avatar)</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>{note}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button onClick={testToken}  style={btn}>Test Token</button>
        <button onClick={testAvatar} style={btn}>Test Avatar</button>
        <button onClick={onStart}    style={btnPrimary}>Start</button>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: .8 }}>
        <code>window.__HEYGEN_DEBUG__</code> will contain {'{ token, avatarName }'} after Start.
      </div>

      <div style={{ marginTop: 20, position: 'relative', width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video id="video" ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

const btn = {
  padding: '10px 16px',
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: 8,
  cursor: 'pointer'
};

const btnPrimary = {
  ...btn,
  background: '#1e90ff',
  border: '1px solid #1e90ff'
};

  ...btn,
  background: '#1e90ff',
  border: '1px solid #1e90ff'
};
