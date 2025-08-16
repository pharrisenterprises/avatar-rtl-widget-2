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
    const av  = await avRes.json().catch(() => ({}));
    const token = tok?.token || tok?.access_token || tok?.data?.token;
    const avatarName = av?.id || av?.avatarName || av?.name;
    if (!token) throw new Error('No token from /api/heygen-token');
    if (!avatarName) throw new Error('No avatar id from /api/heygen-avatars');
    (window).__HEYGEN_DEBUG__ = { token, avatarName };
    console.log('[DBG] token/ava', { avatarName, tokenLen: String(token).length });
    return { token, avatarName };
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function attachStream(ms, el, tag) {
    if (!ms || !el) return false;
    try {
      el.srcObject = ms;
      el.muted = true; // keep autoplay-friendly; UI toggle below
      await el.play?.().catch(() => {});
      console.log(`[ATTACH] via ${tag} (vtracks=${ms.getVideoTracks?.().length || 0})`);
      return true;
    } catch (e) {
      console.log('[ATTACH] failed', e);
      return false;
    }
  }

  /** Wait for a MediaStream to gain a video track, using 'addtrack'. */
  async function waitForVideoTrack(ms, el, timeoutMs = 30000, label = 'client.mediaStream') {
    if (!(ms instanceof MediaStream)) return false;

    // If a video track already exists, attach immediately.
    const nowTracks = ms.getVideoTracks?.() || [];
    if (nowTracks.length) return attachStream(ms, el, `${label} (immediate)`);

    console.log(`[ATTACH] waiting for video track on ${label}…`);
    return new Promise((resolve) => {
      let done = false;
      const onAddTrack = async (ev) => {
        if (done) return;
        if (ev.track && ev.track.kind === 'video') {
          done = true;
          ms.removeEventListener?.('addtrack', onAddTrack);
          await attachStream(ms, el, `${label} (addtrack)`);
          resolve(true);
        }
      };
      ms.addEventListener?.('addtrack', onAddTrack);

      // Fallback polling in case the browser doesn’t fire addtrack reliably.
      const start = Date.now();
      (async function poll() {
        while (!done && Date.now() - start < timeoutMs) {
          const v = ms.getVideoTracks?.() || [];
          if (v.length) {
            done = true;
            ms.removeEventListener?.('addtrack', onAddTrack);
            await attachStream(ms, el, `${label} (poll)`);
            resolve(true);
            return;
          }
          await sleep(300);
        }
        if (!done) {
          ms.removeEventListener?.('addtrack', onAddTrack);
          console.log(`[ATTACH] timeout waiting for track on ${label}`);
          resolve(false);
        }
      })();
    });
  }

  function firstVideoTrackFromPubs(pubs) {
    for (const pub of pubs) {
      const t = pub?.track;
      if (pub?.kind === 'video' && t && typeof t.attach === 'function') {
        return t;
      }
    }
    return null;
  }

  /** Try LiveKit sources (local first, then remote), with polling. */
  async function tryLiveKit({ client, el, timeoutMs = 30000 }) {
    const room = client?.room || client?.livekit?.room;
    if (!room) throw new Error('no room');

    const started = Date.now();

    const attachLocal = () => {
      try {
        const lp = room.localParticipant;
        if (lp?.videoTracks?.size) {
          const pubs = Array.from(lp.videoTracks.values());
          const vt = firstVideoTrackFromPubs(pubs);
          if (vt) {
            const mediaEl = vt.attach();
            el.srcObject = mediaEl?.srcObject || null;
            el.play?.().catch(()=>{});
            console.log('[ATTACH] LiveKit LOCAL track');
            return true;
          }
        }
      } catch {}
      return false;
    };

    const attachRemote = () => {
      const parts = Array.from(room.participants?.values?.() || []);
      for (const p of parts) {
        const pubs = Array.from(p.videoTracks?.values?.() || []);
        const vt = firstVideoTrackFromPubs(pubs);
        if (vt) {
          const mediaEl = vt.attach();
          el.srcObject = mediaEl?.srcObject || null;
          el.play?.().catch(()=>{});
          console.log('[ATTACH] LiveKit REMOTE track');
          return true;
        }
      }
      return false;
    };

    if (attachLocal() || attachRemote()) return true;

    let done = false;
    const onTrackSubscribed = (track, pub) => {
      if (done) return;
      if (pub?.kind === 'video' && track) {
        const mediaEl = track.attach();
        el.srcObject = mediaEl?.srcObject || null;
        el.play?.().catch(()=>{});
        done = true;
        cleanup();
        console.log('[ATTACH] LiveKit REMOTE (event trackSubscribed)');
      }
    };
    const onTrackPublished = (pub) => {
      if (done) return;
      if (pub?.kind === 'video' && pub?.track) {
        const mediaEl = pub.track.attach();
        el.srcObject = mediaEl?.srcObject || null;
        el.play?.().catch(()=>{});
        done = true;
        cleanup();
        console.log('[ATTACH] LiveKit REMOTE (event trackPublished)');
      }
    };
    const cleanup = () => {
      try { room.off?.('trackSubscribed', onTrackSubscribed); } catch {}
      try { room.off?.('trackPublished', onTrackPublished); } catch {}
    };
    try { room.on?.('trackSubscribed', onTrackSubscribed); } catch {}
    try { room.on?.('trackPublished', onTrackPublished); } catch {}

    while (!done && Date.now() - started < timeoutMs) {
      if (attachLocal() || attachRemote()) { done = true; break; }
      console.log('[DBG] LiveKit poll… waited', Date.now() - started, 'ms; remotes:', room.participants?.size || 0);
      await sleep(500);
    }
    cleanup();

    if (!done) throw new Error('no livekit video track');
    return true;
  }

  /** Universal: prefer direct client.mediaStream (with addtrack), then LiveKit. */
  async function attachUniversal({ client, session, el }) {
    if (!el) throw new Error('attachUniversal: missing <video>');
    el.muted = !!muted;

    console.log('[DBG] client keys:', Object.keys(client || {}));
    if (session) console.log('[DBG] session keys:', Object.keys(session || {}));

    // 1) If the SDK exposes a direct MediaStream, wait for its video track.
    if (client?.mediaStream instanceof MediaStream) {
      const ok = await waitForVideoTrack(client.mediaStream, el, 30000, 'client.mediaStream');
      if (ok) return true;
    }

    // 2) Built-in helpers on client/session (if present).
    for (const k of ['attachToElement', 'attachElement']) {
      if (typeof client?.[k] === 'function') {
        console.log('[ATTACH] using client.' + k);
        await client[k](el);
        await el.play?.().catch(()=>{});
        return true;
      }
    }
    for (const k of ['attachToElement', 'attachElement']) {
      if (typeof session?.[k] === 'function') {
        console.log('[ATTACH] using session.' + k);
        await session[k](el);
        await el.play?.().catch(()=>{});
        return true;
      }
    }

    // 3) Session-provided streams (if any)
    const sessMs = session?.mediaStream || session?.stream || session?.remoteStream;
    if (sessMs instanceof MediaStream) {
      const ok = await waitForVideoTrack(sessMs, el, 30000, 'session.*stream');
      if (ok) return true;
    }

    // 4) LiveKit path
    await tryLiveKit({ client, el, timeoutMs: 30000 });
    return true;
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
      console.log('[DBG] new client:', client);

      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        version: 'v3',
      });
      console.log('[DBG] session:', session);

      await attachUniversal({ client, session, el: videoRef.current });

      if (videoRef.current) {
        videoRef.current.muted = !!muted;
        await videoRef.current.play?.().catch(()=>{});
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

  // ---------- Retell text chat ----------
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
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
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
              onKeyDown={e=>{ if (e.key==='Enter') sendText(); }}
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
const btn = { background:'#1e90ff', border:'1px solid #1e90ff', color:'#fff', padding:'6px 10px', borderRadius:8, cursor:'pointer', fontSize:14 };
const btnSmall = { ...btn, padding:'6px 10px', fontSize:13 };
const tag = (s) => ({ display:'inline-block', fontSize:12, padding:'4px 8px', borderRadius:8, marginBottom:8, background:s==='started'?'#12b88622':'#ffffff14', border:'1px solid #ffffff22' });
const chatBox = { marginTop: 10 };
const chatHead = { fontSize: 12, opacity:.8, marginBottom: 6 };
const chatLog = { height: 90, overflowY: 'auto', border:'1px solid #2a2a2a', borderRadius:8, padding:8, background:'#0e0e0e', marginBottom: 6, fontSize:13 };
const chatInputRow = { display:'flex', gap:6 };
const inputStyle = { flex:1, background:'#0e0e0e', color:'#fff', border:'1px solid '#2a2a2a', borderRadius:8, padding:'6px 8px', outline:'none' };
