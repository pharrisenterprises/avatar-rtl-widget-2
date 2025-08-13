'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// use the loader you already have
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

function cx(...c){ return c.filter(Boolean).join(' '); }

export default function Embed() {
  // UI state
  const [status, setStatus] = useState('idle'); // idle | loading-sdk | starting | started | error | ended
  const [note, setNote] = useState('');

  // heygen
  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const sessionRef = useRef(null);

  // chat
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'system', text: 'Type a message below — or turn on the mic.' }
  ]);
  const [sending, setSending] = useState(false);

  const autostart = useMemo(() => {
    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    return sp.get('autostart') === '1';
  }, []);

  // ---- helpers
  function push(role, text) {
    setMessages(m => [...m, { role, text }]);
  }

  async function fetchJson(path, init) {
    const r = await fetch(path, { cache: 'no-store', ...init });
    if (!r.ok) throw new Error(`${init?.method || 'GET'} ${path} failed: ${r.status}`);
    const j = await r.json().catch(() => ({}));
    return j;
  }

  // ---- start/stop
  async function startAvatar() {
    try {
      setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
      const HeyGenStreamingAvatar = await loadHeygenSdk();

      setStatus('starting'); setNote('Fetching credentials…');
      const { token }  = await fetchJson('/api/heygen-token');
      const { id: avatarName } = await fetchJson('/api/heygen-avatars');

      // expose for quick inspect
      window.__HEYGEN_DEBUG__ = { token, avatarName };

      setNote(`Starting ${avatarName}…`);
      const client = new HeyGenStreamingAvatar({ token });       // session token (NOT API key)
      clientRef.current = client;

      // v3 or higher per HeyGen guidance
      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        version: 'v3'
      });
      sessionRef.current = session;

      if (!videoRef.current) throw new Error('Missing <video>');
      if (typeof client.attachToElement !== 'function') {
        throw new Error('attachToElement() missing on client');
      }

      // pipe the remote stream to the video element
      await client.attachToElement(videoRef.current);

      setStatus('started'); setNote('Streaming');
    } catch (err) {
      console.error(err);
      setStatus('error'); setNote(err?.message || 'start failed');
      push('system', `Error: ${err?.message || 'start failed'}`);
    }
  }

  async function endAvatar() {
    try {
      if (clientRef.current?.stop) await clientRef.current.stop();
    } catch {}
    clientRef.current = null;
    sessionRef.current = null;
    setStatus('ended'); setNote('Ended');
  }

  // ---- mic / mute (UI only; mic capture not yet bridged to agent)
  const [muted, setMuted] = useState(false);
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  // ---- text chat → backend → speak with avatar
  async function onSend(e) {
    e?.preventDefault?.();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    push('user', text);

    try {
      setSending(true);
      // Call your existing backend route. It should return { reply: "..." }.
      const res = await fetchJson('/api/retell-chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const reply = res?.reply || '(No reply from agent)';
      push('agent', reply);

      // Speak it with the active HeyGen session
      const client = clientRef.current;
      if (client && typeof client.speakText === 'function') {
        await client.speakText(reply);
      }
    } catch (err) {
      console.error(err);
      push('system', `Agent error: ${err?.message || err}`);
    } finally {
      setSending(false);
    }
  }

  // ---- autostart
  useEffect(() => { if (autostart) startAvatar(); }, [autostart]);

  return (
    <div style={page}>
      <div style={card}>
        {/* status pill */}
        <div style={pill}>
          <span>{status}</span>
          {status === 'started' && <span style={{opacity:.7}}> — Streaming</span>}
        </div>

        {/* video */}
        <div style={videoWrap}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            style={video}
          />
        </div>

        {/* controls */}
        <div style={controls}>
          <button onClick={toggleMute} style={chip}>{muted ? 'Unmute' : 'Mute'}</button>
          {/* placeholder for true mic capture; off for now */}
          <button disabled style={chip}>Mic Off</button>
          {status !== 'started' && (
            <button onClick={startAvatar} style={chipPrimary}>Start</button>
          )}
          {status === 'started' && (
            <button onClick={endAvatar} style={chipDanger}>End</button>
          )}
          <a href="#" onClick={() => window.close?.()} style={chip}>Close</a>
        </div>

        {/* text chat */}
        <div style={chatWrap}>
          <div style={chatHeader}>
            <strong>Text Chat</strong>
            <span style={{opacity:.7}}>{status === 'started' ? 'Streaming' : note}</span>
          </div>
          <div style={chatBody} id="chat-scroll">
            {messages.map((m, i) => (
              <div key={i} style={msgRow}>
                <div style={cx(
                  'bubble',
                ) && (m.role === 'user' ? bubbleUser : m.role === 'agent' ? bubbleAgent : bubbleSystem)}>
                  <span style={{opacity:.65, fontSize:12, marginRight:6}}>
                    {m.role === 'user' ? 'You' : m.role === 'agent' ? 'Agent' : 'System'}
                  </span>
                  <span>{m.text}</span>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={onSend} style={chatForm}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type a message…"
              style={input}
            />
            <button type="submit" style={sendBtn} disabled={sending || !clientRef.current}>
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* --- styles --- */
const page = { minHeight:'100vh', background:'#0b0b0b', display:'grid', placeItems:'start center', padding:'32px 16px', color:'#fff', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' };
const card = { width:'min(420px, 92vw)', display:'flex', flexDirection:'column', gap:10 };
const pill = { alignSelf:'flex-start', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.12)', padding:'6px 10px', borderRadius:10, fontSize:12 };
const videoWrap = { width:'100%', aspectRatio:'3 / 4', borderRadius:16, overflow:'hidden', background:'#000', boxShadow:'0 6px 30px rgba(0,0,0,.35)' };
const video = { width:'100%', height:'100%', objectFit:'cover', display:'block' };
const controls = { display:'flex', gap:8, justifyContent:'center', marginTop:6 };
const chip = { padding:'8px 12px', borderRadius:999, background:'#222', border:'1px solid #333', color:'#fff', cursor:'pointer', textDecoration:'none' };
const chipPrimary = { ...chip, background:'#1e90ff', borderColor:'#1e90ff' };
const chipDanger = { ...chip, background:'#b72d2d', borderColor:'#b72d2d' };

const chatWrap = { background:'#121212', border:'1px solid #202020', borderRadius:12, overflow:'hidden' };
const chatHeader = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#161616', borderBottom:'1px solid #202020', fontSize:13 };
const chatBody = { maxHeight:220, overflow:'auto', padding:'8px' };
const msgRow = { margin:'6px 0' };
const bubbleBase = { display:'inline-block', padding:'8px 10px', borderRadius:10, lineHeight:1.25, fontSize:14 };
const bubbleUser = { ...bubbleBase, background:'#1f3a6d', border:'1px solid #2b4f92' };
const bubbleAgent = { ...bubbleBase, background:'#1c2a1c', border:'1px solid #254525' };
const bubbleSystem = { ...bubbleBase, background:'#1a1a1a', border:'1px solid #2a2a2a' };
const chatForm = { display:'flex', gap:8, padding:'8px', borderTop:'1px solid #202020' };
const input = { flex:1, padding:'10px 12px', borderRadius:8, border:'1px solid #2a2a2a', background:'#0f0f0f', color:'#fff', outline:'none' };
const sendBtn = { padding:'10px 14px', borderRadius:8, background:'#1e90ff', border:'1px solid #1e90ff', color:'#fff', cursor:'pointer' };
