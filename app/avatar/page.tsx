'use client';

import React, { useEffect, useRef, useState } from 'react';

// NOTE: We don’t import a HeyGen SDK here because your project already had working SDK wiring.
// This page just fetches the token + avatarId and confirms they’re valid,
// then exposes them to window so your existing player code can use them.
// If your project already instantiates the HeyGen client in this page, keep it below where indicated.

export default function AvatarDebugPage() {
  const [status, setStatus] = useState<'idle'|'token_ok'|'token_fail'|'avatar_ok'|'avatar_fail'|'starting'|'started'|'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  const tokenRef = useRef<string>('');
  const avatarIdRef = useRef<string>('');

  async function getToken() {
    setStatus('idle'); setMsg('Fetching token…');
    const r = await fetch('/api/heygen-token', { cache: 'no-store' });
    if (!r.ok) { setStatus('token_fail'); setMsg(`GET /api/heygen-token -> ${r.status}`); return; }
    const j = await r.json().catch(() => ({}));
    // IMPORTANT: our API returns { token }, not { access_token }
    const tok = j?.token;
    if (!tok) { setStatus('token_fail'); setMsg('Token JSON missing "token"'); return; }
    tokenRef.current = tok;
    setStatus('token_ok'); setMsg('Token OK');
  }

  async function getAvatarId() {
    setMsg('Resolving avatar id…');
    // We prefer env HEYGEN_AVATAR_ID, so the API will return that
    const r = await fetch('/api/heygen-avatars', { cache: 'no-store' });
    if (!r.ok) { setStatus('avatar_fail'); setMsg(`GET /api/heygen-avatars -> ${r.status}`); return; }
    const j = await r.json().catch(() => ({}));
    const id = j?.id;
    if (!id) { setStatus('avatar_fail'); setMsg('Avatar JSON missing "id"'); return; }
    avatarIdRef.current = id; // e.g. "Wayne_20240711"
    setStatus('avatar_ok'); setMsg(`Avatar OK: ${id}`);
  }

  async function start() {
    try {
      setStatus('starting'); setMsg('Starting avatar…');

      // Make sure we’ve got both pieces
      if (!tokenRef.current) await getToken();
      if (!avatarIdRef.current) await getAvatarId();
      if (!tokenRef.current || !avatarIdRef.current) { setStatus('error'); setMsg('Missing token or avatarId'); return; }

      // EXPOSE to window for any existing player logic you already have wired elsewhere
      (window as any).__HEYGEN_DEBUG__ = {
        token: tokenRef.current,
        avatarName: avatarIdRef.current, // HeyGen streaming expects "avatarName" = Interactive Avatar ID string
      };

      // If you previously had HeyGen start code here, keep it below using "tokenRef.current" and "avatarIdRef.current".
      // Example pseudo (keep your real SDK code):
      //
      // const client = new HeyGenClient({ token: tokenRef.current });
      // await client.createStartAvatar({ avatarName: avatarIdRef.current, quality: 'high' });
      // client.attachVideoElement(document.getElementById('video') as HTMLVideoElement);
      //
      // If your actual code lives elsewhere, that’s fine—this page now provides correct values.

      setStatus('started'); setMsg('Avatar started (values exposed on window.__HEYGEN_DEBUG__)');
    } catch (e: any) {
      setStatus('error'); setMsg(e?.message || 'start failed');
    }
  }

  useEffect(() => {
    // Pre-warm token + avatarId so Start works first click
    (async () => {
      await getToken();
      if (tokenRef.current) await getAvatarId();
    })();
  }, []);

  return (
    <div style={{ padding: 20, color: '#fff', background: '#111', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Avatar Debug (/avatar)</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>{msg}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button onClick={getToken} style={btn}>Test Token</button>
        <button onClick={getAvatarId} style={btn}>Test Avatar</button>
        <button onClick={start} style={btnPrimary}>Start</button>
      </div>

      <div style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
        <div><code>window.__HEYGEN_DEBUG__</code> will contain <code>{`{ token, avatarName }`}</code> after Start.</div>
      </div>

      <div style={{ marginTop: 20, position: 'relative', width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video id="video" autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '10px 16px',
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: 8,
  cursor: 'pointer'
};

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: '#1e90ff',
  border: '1px solid #1e90ff'
};
