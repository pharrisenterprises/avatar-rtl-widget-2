'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadHeygenSdk } from '../lib/loadHeygenSdk'; // you already have this

export default function EmbedPage() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading-sdk | starting | started | error
  const [note, setNote] = useState('');
  const [muted, setMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const clientRef = useRef(null);
  const stopRef = useRef(null);

  async function getToken() {
    const r = await fetch('/api/heygen-token', { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET /api/heygen-token -> ${r.status}`);
    const j = await r.json();
    if (!j?.token) throw new Error('Token JSON missing "token"');
    return j.token;
  }
  async function getAvatarId() {
    const r = await fetch('/api/heygen-avatars', { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET /api/heygen-avatars -> ${r.status}`);
    const j = await r.json();
    if (!j?.id) throw new Error('Avatar JSON missing "id"');
    return j.id; // e.g. "Wayne_20240711"
  }

  async function startAvatar() {
    try {
      setStatus('loading-sdk'); setNote('Loading SDK…');
      const HeyGenStreamingAvatar = await loadHeygenSdk();

      setNote('Fetching credentials…');
      const [token, avatarName] = await Promise.all([getToken(), getAvatarId()]);

      setStatus('starting'); setNote(`Starting ${avatarName}…`);
      const client = new HeyGenStreamingAvatar({ token }); // NOTE: use token (session), not API key
      clientRef.current = client;

      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        // (we’ll pass Retell signaling here later)
      });

      // Some SDKs return helpers on the client, some on the session — try both:
      const maybeAttach = client.attachToElement || session.attachToElement;
      const maybeStream = client.mediaStream || session.mediaStream;

      if (maybeAttach && videoRef.current) {
        await maybeAttach.call(client, videoRef.current);
      } else if (maybeStream && videoRef.current) {
        // fallback: use MediaStream directly
        videoRef.current.srcObject = maybeStream;
        await videoRef.current.play().catch(() => {});
      } else {
        throw new Error('No attach function or MediaStream available');
      }

      // expose for quick debug
      window.__HEYGEN_DEBUG__ = { token, avatarName, session, client };

      // handle mute and mic
      setMuted(false);
      setMicEnabled(true);
      setStatus('started'); setNote('Streaming');

      // keep a stop function
      stopRef.current = async () => {
        try { await client.stop?.(); } catch {}
        try { await session.stop?.(); } catch {}
        if (videoRef.current) videoRef.current.srcObject = null;
        setStatus('idle'); setNote('');
      };
    } catch (err) {
      console.error(err);
      setStatus('error'); setNote(err?.message || 'Failed to start');
    }
  }

  function toggleMute() {
    setMuted(v => !v);
    if (videoRef.current) videoRef.current.muted = !muted;
  }

  function toggleMic() {
    setMicEnabled(v => !v);
    // We’ll wire actual mic enable/disable to the SDK once we confirm the method names
    // (some SDKs expose client.enableMic / client.disableMic or tracks on session)
  }

  async function stopAvatar() {
    if (stopRef.current) await stopRef.current();
  }

  // postMessage API: parent can ask us to open/start/close
  useEffect(() => {
    function onMessage(ev) {
      if (!ev?.data || typeof ev.data !== 'object') return;
      const { type } = ev.data;
      if (type === 'aiw/start') startAvatar();
      if (type === 'aiw/stop')  stopAvatar();
      if (type === 'aiw/toggleMute') toggleMute();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Autostart if ?autostart=1
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get('autostart') === '1') startAvatar();
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0b0b0b',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12
    }}>
      <div style={{
        position: 'relative',
        width: 420, maxWidth: '96vw', height: 640, maxHeight: '96vh',
        borderRadius: 16, overflow: 'hidden', boxShadow: '0 16px 60px rgba(0,0,0,.45)',
        background: '#000'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* overlay controls */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          display: 'flex', gap: 8, justifyContent: 'center',
          padding: 12, background: 'linear-gradient(transparent, rgba(0,0,0,.6))'
        }}>
          {status !== 'started' ? (
            <button onClick={startAvatar} style={btnPrimary}>Start</button>
          ) : (
            <>
              <button onClick={toggleMute} style={btn}>
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={toggleMic} style={btn}>
                {micEnabled ? 'Mic Off' : 'Mic On'}
              </button>
              <button onClick={stopAvatar} style={btn}>End</button>
            </>
          )}
          <button onClick={() => window.parent?.postMessage({ type: 'aiw/close' }, '*')} style={btn}>Close</button>
        </div>

        {/* status */}
        <div style={{
          position: 'absolute', top: 10, left: 12, padding: '6px 10px',
          borderRadius: 8, backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,.35)',
          color: '#fff', fontSize: 12
        }}>
          {status}{note ? ` — ${note}` : ''}
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,.2)',
  background: 'rgba(0,0,0,.35)',
  color: '#fff',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)'
};

const btnPrimary = {
  ...btn,
  background: '#1e90ff',
  border: '1px solid #1e90ff'
};
