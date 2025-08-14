'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadHeygenSdk } from '@/app/lib/loadHeygenSdk';

const PANEL_W = 360; // compact widget size
const PANEL_H = 420;

export default function EmbedPage() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle');        // idle | loading-sdk | starting | started | error | ended
  const [note, setNote] = useState('');
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(false);
  const startingRef = useRef(false);

  // helpers
  const pushChat = (role, text) =>
    setChat(prev => [...prev, { role, text, t: Date.now() }]);

  async function getTokenAndAvatar() {
    const [tokRes, avRes] = await Promise.all([
      fetch('/api/heygen-token', { cache: 'no-store' }),
      fetch('/api/heygen-avatars', { cache: 'no-store' }),
    ]);
    const tokJson = await tokRes.json();
    const avJson = await avRes.json();
    const token = tokJson?.token || tokJson?.access_token || tokJson?.data?.token;
    const avatarName = avJson?.id || avJson?.avatarName || avJson?.name;
    if (!token) throw new Error('No token from /api/heygen-token');
    if (!avatarName) throw new Error('No avatar id from /api/heygen-avatars');
    // make visible for quick debug
    window.__HEYGEN_DEBUG__ = { token, avatarName };
    return { token, avatarName };
  }

  // === UNIVERSAL ATTACH: tries every known shape (client + session) ===
  async function attachUniversal({ client, session, el }) {
    if (!el) throw new Error('attachUniversal: missing <video> element');

    // 1) SDKs that expose client.attachToElement
    if (typeof client.attachToElement === 'function') {
      await client.attachToElement(el);
      await el.play().catch(()=>{});
      return true;
    }
    // 2) some expose client.attachElement
    if (typeof client.attachElement === 'function') {
      await client.attachElement(el);
      await el.play().catch(()=>{});
      return true;
    }
    // 3) client getter(s) → MediaStream
    if (typeof client.getRemoteMediaStream === 'function') {
      const ms = await client.getRemoteMediaStream();
      if (ms) { el.srcObject = ms; await el.play().catch(()=>{}); return true; }
    }
    if (typeof client.getMediaStream === 'function') {
      const ms = await client.getMediaStream();
      if (ms) { el.srcObject = ms; await el.play().catch(()=>{}); return true; }
    }
    // 4) session-based helpers
    if (session) {
      if (typeof session.attachToElement === 'function') {
        await session.attachToElement(el);
        await el.play().catch(()=>{});
        return true;
      }
      if (typeof session.attachElement === 'function') {
        await session.attachElement(el);
        await el.play().catch(()=>{});
        return true;
      }
      const ms = session.mediaStream || session.stream || session.remoteStream;
      if (ms) { el.srcObject = ms; await el.play().catch(()=>{}); return true; }
    }
    throw new Error('No attach function or MediaStream available');
  }

  async function startAvatar() {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
      const HeyGenStreamingAvatar = await loadHeygenSdk();

      setNote('Fetching token + avatar id…');
      const { token, avatarName } = await getTokenAndAvatar();

      setStatus('starting'); setNote(`Starting ${avatarName}…`);

      // Start the SDK (force v3 — older versions are deprecated)
      const client = new HeyGenStreamingAvatar({ token }); // session token, not API key
      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        version: 'v3',
      });

      // Attach video using universal path
      await attachUniversal({ client, session, el: videoRef.current });

      // set mute state on <video>
      if (videoRef.current) {
        videoRef.current.muted = !!muted;
        await videoRef.current.play().catch(()=>{});
      }

      setStatus('started'); setNote('Streaming');
    } catch (e) {
      console.error(e);
      setStatus('error'); setNote(e?.message || 'start failed');
    } finally {
      startingRef.current = false;
    }
  }

  function stopAvatar() {
    try {
      if (videoRef.current) {
        const ms = videoRef.current.srcObject;
        if (ms && typeof ms.getTracks === 'function') {
          ms.getTracks().forEach(t => t.stop());
        }
        videoRef.current.srcObject = null;
      }
      setStatus('ended'); setNote('Stopped');
    } catch (e) {
      console.warn('stop error', e);
    }
  }

  async function sendText() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    pushChat('user', text);
    try {
      const r = await fetch('/api/retell-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }).then(r => r.json());
      const reply =
        r?.reply?.text || r?.text || r?.message || '(no response)';
      pushChat('assistant', reply);
    } catch (e) {
      pushChat('assistant', '(send failed)');
    }
  }

  // autostart support
  const autostart = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('autostart') === '1';
    } catch { return false; }
  }, []);

  useEffect(() => {
    if (autostart) startAvatar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart]);

  return (
    <div style={outerWrap}>
      <div style={panel}>
        <div style={tag(status)}>{status}{note ? ` — ${note}` : ''}</div>

        <div style={videoShell}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div style={btnRow}>
          {status !== 'started' && <button onClick={startAvatar} style={btn}>Start</button>}
          {status === 'started' && (
            <>
              <button onClick={() => { setMuted(m => !m); if (videoRef.current) videoRef.current.muted = !muted; }} style={btn}>
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={stopAvatar} style={btn}>End</button>
            </>
          )}
        </div>

        {/* Text chat */}
        <div style={chatBox}>
          <div style={chatHead}>Text Chat <span style={{opacity:.6, fontSize:12}}>(beta)</span></div>
          <div style={chatLog}>
            {chat.map(m => (
              <div key={m.t} style={{ marginBottom: 6 }}>
                <strong style={{ textTransform:'capitalize' }}>{m.role}:</strong>{' '}
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <div style={chatInputRow}>
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') sendText(); }}
              placeholder="Type a message…"
              style={inputStyle}
            />
            <button onClick={sendText} style={btnSmall}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- styles --- */
const outerWrap = {
  minHeight: '100vh',
  background: '#0b0b0b',
  display: 'grid',
  placeItems: 'center',
  color: '#fff',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto',
};

const panel = {
  width: PANEL_W,
  minHeight: PANEL_H,
  borderRadius: 16,
  background: '#111',
  padding: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
};

const videoShell = {
  width: '100%',
  aspectRatio: '3/4',
  borderRadius: 12,
  overflow: 'hidden',
  background: '#000',
};

const btnRow = { display: 'flex', gap: 8, marginTop: 8 };
const btn = {
  background: '#1e90ff',
  border: '1px solid #1e90ff',
  color: '#fff',
  padding: '6px 10px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
};
const btnSmall = { ...btn, padding: '6px 10px', fontSize: 13 };

const tag = (s) => ({
  display: 'inline-block',
  fontSize: 12,
  padding: '4px 8px',
  borderRadius: 8,
  marginBottom: 8,
  background: s === 'started' ? '#12b88622' : '#ffffff14',
  border: '1px solid #ffffff22',
});

const chatBox = { marginTop: 10 };
const chatHead = { fontSize: 12, opacity: .8, marginBottom: 6 };
const chatLog = {
  height: 90,
  overflowY: 'auto',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: 8,
  background: '#0e0e0e',
  marginBottom: 6,
  fontSize: 13,
};
const chatInputRow = { display: 'flex', gap: 6 };
const inputStyle = {
  flex: 1,
  background: '#0e0e0e',
  color: '#fff',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  padding: '6px 8px',
  outline: 'none',
};
