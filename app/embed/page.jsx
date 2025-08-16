'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadHeygenSdk } from '@/app/lib/loadHeygenSdk';

const PANEL_W = 360;
const PANEL_H = 420;

export default function EmbedPage() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [note, setNote] = useState('');
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState('');
  const [muted, setMuted] = useState(true);
  const [chatId, setChatId] = useState(null);
  const startingRef = useRef(false);

  const pushChat = (role, text) =>
    setChat(prev => [...prev, { role, text, t: Date.now() }]);

  async function getTokenAndAvatar() {
    const [tokRes, avRes] = await Promise.all([
      fetch('/api/heygen-token', { cache: 'no-store' }),
      fetch('/api/heygen-avatars', { cache: 'no-store' }),
    ]);
    const tok = await tokRes.json().catch(() => ({}));
    const av = await avRes.json().catch(() => ({}));
    const token = tok?.token || tok?.access_token || tok?.data?.token;
    const avatarName = av?.id || av?.avatarName || av?.name;
    if (!token) throw new Error('No token from /api/heygen-token');
    if (!avatarName) throw new Error('No avatar id from /api/heygen-avatars');
    window.__HEYGEN_DEBUG__ = { token, avatarName, tokenLen: String(token).length };
    return { token, avatarName };
  }

  async function attachFromLiveKitRoom(room, el) {
    return new Promise((resolve, reject) => {
      if (!room) return reject(new Error('no room'));
      let done = false;
      const TIMEOUT_MS = 31000;
      const started = Date.now();

      const useTrack = (track) => {
        try {
          if (!track || typeof track.attach !== 'function') return;
          const mediaEl = track.attach();
          if (mediaEl && mediaEl.srcObject) {
            el.srcObject = mediaEl.srcObject;
          } else if (mediaEl instanceof HTMLVideoElement) {
            el.srcObject = mediaEl.srcObject || null;
          }
          el.play?.().catch(() => {});
          done = true;
          cleanup();
          resolve(true);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };

      const checkExisting = () => {
        try {
          const parts = Array.from(room.participants?.values?.() || []);
          for (const p of parts) {
            const pubs = Array.from(p.videoTracks?.values?.() || []);
            for (const pub of pubs) {
              if (pub?.isSubscribed && pub.track) {
                useTrack(pub.track);
                return true;
              }
            }
          }
        } catch {}
        return false;
      };

      const onTrackSubscribed = (track, pub) => {
        if (!done && pub?.kind === 'video' && track) useTrack(track);
      };
      const onTrackPublished = (pub) => {
        if (!done && pub?.kind === 'video' && pub.track) useTrack(pub.track);
      };

      const cleanup = () => {
        try { room.off?.('trackSubscribed', onTrackSubscribed); } catch {}
        try { room.off?.('trackPublished', onTrackPublished); } catch {}
      };

      if (checkExisting()) return;

      try {
        room.on?.('trackSubscribed', onTrackSubscribed);
        room.on?.('trackPublished', onTrackPublished);
      } catch {}

      const tick = () => {
        if (done) return;
        const elapsed = Date.now() - started;
        if (elapsed >= TIMEOUT_MS) {
          cleanup();
          reject(new Error('no livekit video track'));
          return;
        }
        if (checkExisting()) return;
        setTimeout(tick, 1000);
      };
      tick();
    });
  }

  async function attachUniversal({ client, session, el }) {
    if (!el) throw new Error('attachUniversal: missing <video>');
    el.muted = !!muted;

    if (typeof client.attachToElement === 'function') {
      await client.attachToElement(el);
      await el.play?.().catch(() => {});
      return true;
    }
    if (typeof client.attachElement === 'function') {
      await client.attachElement(el);
      await el.play?.().catch(() => {});
      return true;
    }

    for (const key of ['getRemoteMediaStream', 'getMediaStream']) {
      if (typeof client[key] === 'function') {
        const ms = await client[key]();
        if (ms) { el.srcObject = ms; await el.play?.().catch(() => {}); return true; }
      }
    }

    if (session) {
      for (const k of ['attachToElement', 'attachElement']) {
        if (typeof session[k] === 'function') {
          await session[k](el);
          await el.play?.().catch(() => {});
          return true;
        }
      }
      const ms = session.mediaStream || session.stream || session.remoteStream;
      if (ms) { el.srcObject = ms; await el.play?.().catch(() => {}); return true; }
    }

    const room = client.room || session?.room || client.livekit?.room;
    if (room) {
      await attachFromLiveKitRoom(room, el);
      return true;
    }

    throw new Error('No attach function or MediaStream available');
  }

  async function startAvatar() {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
      const Ctor = await loadHeygenSdk();

      setNote('Fetching token + avatar id…');
      const { token, avatarName } = await getTokenAndAvatar();

      setStatus('starting'); setNote(`Starting ${avatarName}…`);

      const client = new Ctor({ token });
      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        version: 'v3',
      });

      await attachUniversal({ client, session, el: videoRef.current });

      if (videoRef.current) {
        videoRef.current.muted = !!muted;
        await videoRef.current.play?.().catch(() => {});
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
        if (ms && typeof ms.getTracks === 'function') ms.getTracks().forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
      setStatus('ended'); setNote('Stopped');
    } catch {}
  }

  async function ensureChat() {
    if (chatId) return chatId;
    const r = await fetch('/api/retell-chat/start', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    const id = j?.chatId || j?.id || j?.chat_id;
    if (!id) throw new Error('Retell start failed');
    setChatId(id);
    return id;
  }

  async function sendText() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    pushChat('user', text);
    try {
      const id = await ensureChat();
      const r = await fetch('/api/retell-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: id, text }),
      });
      const j = await r.json().catch(() => ({}));
      const reply = j?.reply?.text || j?.text || j?.message || '(no response)';
      pushChat('assistant', reply);
    } catch {
      pushChat('assistant', '(send failed)');
    }
  }

  const autostart = useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('autostart') === '1'; }
    catch { return false; }
  }, []);

  useEffect(() => { if (autostart) startAvatar(); /* eslint-disable-next-line */ }, [autostart]);

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
              <button
                onClick={() => {
                  setMuted(m => !m);
                  if (videoRef.current) videoRef.current.muted = !muted;
                }}
                style={btn}
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={stopAvatar} style={btn}>End</button>
            </>
          )}
        </div>

        <div style={chatBox}>
          <div style={chatHead}>Text Chat <span style={{ opacity: .6, fontSize: 12 }}>(beta)</span></div>
          <div style={chatLog}>
            {chat.map(m => (
              <div key={m.t} style={{ marginBottom: 6 }}>
                <strong style={{ textTransform: 'capitalize' }}>{m.role}:</strong>{' '}
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <div style={chatInputRow}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendText(); }}
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

/* styles */
const outerWrap = {
  minHeight: '100vh',
  background: '#0b0b0b',
  display: 'grid',
  placeItems: 'center',
  color: '#fff',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto',
};
const panel = { width: PANEL_W, minHeight: PANEL_H, borderRadius: 16, background: '#111', padding: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.45)' };
const videoShell = { width: '100%', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', background: '#000' };
const btnRow = { display: 'flex', gap: 8, marginTop: 8 };
const btn = { background: '#1e90ff', border: '1px solid #1e90ff', color: '#fff', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 14 };
const btnSmall = { ...btn, padding: '6px 10px', fontSize: 13 };
const tag = (s) => ({ display:'inline-block', fontSize: 12, padding:'4px 8px', borderRadius: 8, marginBottom: 8, background: s === 'started' ? '#12b88622' : '#ffffff14', border:'1px solid #ffffff22' });
const chatBox = { marginTop: 10 };
const chatHead = { fontSize: 12, opacity: .8, marginBottom: 6 };
const chatLog = { height: 90, overflowY:'auto', border:'1px solid #2a2a2a', borderRadius:8, padding:8, background:'#0e0e0e', marginBottom: 6, fontSize:13 };
const chatInputRow = { display:'flex', gap:6 };
const inputStyle = { flex:1, background:'#0e0e0e', color:'#fff', border:'1px solid #2a2a2a', borderRadius:8, padding:'6px 8px', outline:'none' };
