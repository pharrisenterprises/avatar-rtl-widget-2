// app/embed/page.tsx
'use client';

import { useState } from 'react';

export default function EmbedDebug() {
  const [log, setLog] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [status, setStatus] = useState('ready');

  async function fetchAvatar() {
    setStatus('resolving avatar…');
    try {
      const name = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
      const r = await fetch(`/api/heygen-avatars?name=${encodeURIComponent(name)}`, { cache: 'no-store' });
      const j = await r.json();
      setLog(l => [`GET /api/heygen-avatars -> ${r.status}`, JSON.stringify(j), ...l]);
      if (j?.ok && j?.id) {
        setAvatar(j.id);
        setStatus('avatar_ok');
      } else {
        setStatus('avatar_error');
      }
    } catch (e: any) {
      setLog(l => [`avatar error: ${e?.message}`, ...l]);
      setStatus('avatar_error');
    }
  }

  async function fetchToken() {
    setStatus('requesting token…');
    try {
      const r = await fetch('/api/heygen-token', { cache: 'no-store' });
      const j = await r.json();
      setLog(l => [`GET /api/heygen-token -> ${r.status}`, JSON.stringify(j), ...l]);
      if (j?.ok && j?.token) {
        setToken(j.token);
        setStatus('token_ok');
      } else {
        setStatus('token_error');
      }
    } catch (e: any) {
      setLog(l => [`token error: ${e?.message}`, ...l]);
      setStatus('token_error');
    }
  }

  return (
    <div style={{background:'#000', color:'#fff', height:'100dvh', display:'flex', flexDirection:'column', gap:12, padding:16, fontFamily:'system-ui' }}>
      <div style={{fontWeight:700}}>Embed Debug</div>
      <div>Status: {status}</div>
      <div style={{display:'flex', gap:8}}>
        <button onClick={fetchAvatar} style={{padding:'8px 12px', borderRadius:8, border:0, background:'#1e90ff', color:'#fff', cursor:'pointer'}}>Test Avatar</button>
        <button onClick={fetchToken}  style={{padding:'8px 12px', borderRadius:8, border:0, background:'#1e90ff', color:'#fff', cursor:'pointer'}}>Test Token</button>
      </div>
      <div>Resolved avatarId: <code>{avatar || '—'}</code></div>
      <div>Token (prefix): <code>{token ? token.slice(0,12)+'…' : '—'}</code></div>
      <div style={{marginTop:8, fontSize:13, opacity:.8}}>AVATAR_NAME: <code>{process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '(not set)'}</code></div>
      <div style={{marginTop:12, borderTop:'1px solid rgba(255,255,255,.12)', paddingTop:12, fontSize:12, whiteSpace:'pre-wrap'}}>
        {log.join('\n')}
      </div>
    </div>
  );
}
