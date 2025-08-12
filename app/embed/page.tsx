// app/embed/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

const AVATAR_NAME = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
const VOICE_ID    = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
const AVATAR_ID   = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID || ''; // optional

export default function Embed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('ready');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [avatarId, setAvatarId] = useState<string>(AVATAR_ID);

  // Resolve avatar id if we only have a name
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setError(null);
      setStatus('resolving avatar');

      try {
        let id = AVATAR_ID;
        if (!id) {
          const res = await fetch(`/api/heygen-avatars?name=${encodeURIComponent(AVATAR_NAME)}`, { cache: 'no-store' });
          const j = await res.json();
          if (!res.ok || !j?.ok || !j?.id) throw new Error(j?.error || 'failed to resolve avatar');
          id = j.id;
        }
        if (cancelled) return;
        setAvatarId(id);

        setStatus('requesting token');
        const tr = await fetch('/api/heygen-token', { cache: 'no-store' });
        const tj = await tr.json();
        if (!tr.ok || !tj?.ok || !tj?.token) throw new Error(tj?.error || 'failed to create token');
        if (cancelled) return;
        setToken(tj.token);

        setStatus('ready_to_start');
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'init_failed');
          setStatus('error');
        }
      }
    }

    boot();
    return () => { cancelled = true; };
  }, []);

  async function start() {
    try {
      setError(null);
      setStatus('starting');

      // Ask for mic after user click (required by browsers)
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Here you would initialize the HeyGen Web SDK (or your bridge) with:
      //  - token
      //  - avatarId
      //  - voiceId
      //
      // Since we’re keeping this generic (no 3rd-party SDK import in this embed),
      // we’ll just show a friendly message so we can verify token+avatar resolved.

      setStatus(`token+avatar OK — avatarId=${avatarId.slice(0,6)}…, voiceId=${VOICE_ID.slice(0,6)}…`);
    } catch (e: any) {
      setError(e?.message || 'permission_failed');
      setStatus('error');
    }
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background:'#000'
    }}>
      {/* (Optional) render target for SDK video */}
      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height:'100%', objectFit:'cover', display:'none' }} />
      <div style={{
        position:'absolute', top:12, left:12, color:'#fff', fontSize:14, fontFamily:'system-ui'
      }}>Status: {status}</div>

      {error && (
        <div style={{
          position:'absolute', bottom:12, left:12, right:12,
          color:'#fff', background:'rgba(255,60,60,.2)', border:'1px solid rgba(255,60,60,.4)',
          padding:'8px 10px', borderRadius:8, fontSize:13
        }}>
          Error: {error}
        </div>
      )}

      <button
        onClick={start}
        disabled={!token || !avatarId || !VOICE_ID || status === 'starting'}
        style={{
          position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
          padding:'10px 16px', borderRadius:10, border:'0',
          background:'#1e90ff', color:'#fff', fontWeight:600, cursor:'pointer',
          opacity: (!token || !avatarId || !VOICE_ID) ? .5 : 1
        }}
      >
        {(!token || !avatarId || !VOICE_ID) ? 'Loading…' : 'Start Mic'}
      </button>
    </div>
  );
}
