'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadHeygenSdk } from '@/app/lib/loadHeygenSdk';

const Box: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div style={{ marginTop: 12, padding: 12, border: '1px solid #333', borderRadius: 8, background: '#181818' }}>
    {children}
  </div>
);

type FetchResult = { ok: boolean; json: any; raw: string; status: number };

export default function AvatarDebugPage() {
  const [status, setStatus] = useState<'idle'|'ready'|'starting'|'started'|'error'>('idle');
  const [info, setInfo]     = useState<string>('');
  const [err, setErr]       = useState<string>('');
  const tokenRef  = useRef<string>('');
  const avatarRef = useRef<string>('');
  const videoRef  = useRef<HTMLVideoElement | null>(null);

  async function get(path: string): Promise<FetchResult> {
    const r = await fetch(path, { cache: 'no-store' });
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), raw: txt, status: r.status }; }
    catch { return { ok: r.ok, json: null, raw: txt, status: r.status }; }
  }

  async function warmup() {
    try {
      setErr('');
      setInfo('Fetching token…');
      const t = await get('/api/heygen-token');
      if (!t.ok || !t.json?.token) throw new Error(`/api/heygen-token -> ${t.status} body:${t.raw.slice(0,120)}`);
      tokenRef.current = t.json.token;

      setInfo('Resolving avatar id…');
      const a = await get('/api/heygen-avatars');
      if (!a.ok || !a.json?.id) throw new Error(`/api/heygen-avatars -> ${a.status} body:${a.raw.slice(0,120)}`);
      avatarRef.current = a.json.id;

      setStatus('ready');
      setInfo(`Ready (avatar=${avatarRef.current.slice(0,60)})`);
      (window as any).__HEYGEN_DEBUG__ = { token: tokenRef.current, avatarName: avatarRef.current };
      console.log('[heygen] warmup ok', (window as any).__HEYGEN_DEBUG__);
    } catch (e: any) {
      setStatus('error');
      setErr(e?.message || 'warmup failed');
      console.error('[heygen] warmup error', e);
    }
  }

  useEffect(() => { void warmup(); }, []);

  async function onStart() {
    try {
      setErr('');
      setStatus('starting');
      setInfo('Loading HeyGen SDK…');

      const HG = await loadHeygenSdk();
      if (!HG || !(window as any).HeyGenStreamingAvatar) throw new Error('SDK global missing after load');

      const token = tokenRef.current;
      const avatarName = avatarRef.current; // e.g., "Wayne_20240711"
      if (!token || !avatarName) throw new Error('Missing token or avatarName');

      (window as any).__HEYGEN_DEBUG__ = { token, avatarName };
      console.log('[heygen] starting with', (window as any).__HEYGEN_DEBUG__);

      const Client = (window as any).HeyGenStreamingAvatar;
      const client = new Client({ token }); // IMPORTANT: uses "token"

      const session = await client.createStartAvatar({ avatarName, quality: 'high' });
      console.log('[heygen] session started', session);

      const videoEl = videoRef.current;
      if (!videoEl) throw new Error('No <video> element');
      const mediaStream = await client.attachToElement(videoEl);
      console.log('[heygen] attached media stream', mediaStream);

      setStatus('started');
      setInfo('Avatar streaming. If video stays black, copy the console logs to me.');
    } catch (e: any) {
      setStatus('error');
      setErr(e?.message || 'start failed');
      console.error('[heygen] start error', e);
    }
  }

  async function testToken()  { setErr(''); const r = await fetch('/api/heygen-token', {cache:'no-store'}); setInfo(await r.text()); }
  async function testAvatar() { setErr(''); const r = await fetch('/api/heygen-avatars', {cache:'no-store'}); setInfo(await r.text()); }

  return (
    <div style={{ padding: 20, color: '#fff', background: '#111', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Avatar Debug (/avatar)</h1>
      <p>Status: <strong>{status}</strong></p>
      {info && <Box><div style={{color:'#9ad1ff'}}>{info}</div></Box>}
      {err  && <Box><div style={{color:'#ff7a7a'}}>ERROR: {err}</div></Box>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button onClick={testToken}  style={btn}>Test Token</button>
        <button onClick={testAvatar} style={btn}>Test Avatar</button>
        <button onClick={onStart}    style={btnPrimary}>Start</button>
      </div>

      <div style={{ marginTop: 12, fontSize: 13, opacity: .8 }}>
        <code>window.__HEYGEN_DEBUG__</code> will contain {'{ token, avatarName }'}.
      </div>

      <div style={{ marginTop: 20, position: 'relative', width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video id="video" ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
