'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function Embed() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle');          // idle | starting | streaming | ended | error
  const [note, setNote] = useState('');
  const [chatId, setChatId] = useState(null);
  const [muted, setMuted] = useState(true);              // start muted by default
  const [mic, setMic] = useState(false);                 // false = text-only
  const [input, setInput] = useState('');
  const [log, setLog] = useState([]);                    // [{role:'user'|'assistant', text:string}]

  // --- avatar start (uses values from your existing backend endpoints) ---
  async function startAvatar() {
    try {
      setStatus('starting'); setNote('Starting avatar…');

      // token
      const tRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const tJson = await tRes.json();
      const token = tJson?.token;
      if (!token) throw new Error('Missing token');

      // avatar id
      const aRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const aJson = await aRes.json();
      const avatarName = aJson?.id; // e.g. "Wayne_20240711"
      if (!avatarName) throw new Error('Missing avatar id');

      // load SDK (your loader already handles multiple fallbacks)
      const mod = await import('../lib/loadHeygenSdk');
      const HeyGenStreamingAvatar = await mod.loadHeygenSdk();

      // create client
      const client = new HeyGenStreamingAvatar({ token });

      // start session (v3)
      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        version: 'v3'
      });

      // attach to <video>
      if (!videoRef.current) throw new Error('Missing <video> element');
      if (typeof client.attachToElement === 'function') {
        await client.attachToElement(videoRef.current);
      } else if (session?.mediaStream instanceof MediaStream) {
        videoRef.current.srcObject = session.mediaStream;
        await videoRef.current.play().catch(() => {});
      } else {
        throw new Error('No attach function or MediaStream available');
      }

      // start Retell text chat session now
      const cRes = await fetch('/api/retell-chat/start', { method: 'POST' });
      const cJson = await cRes.json();
      if (!cJson?.ok) throw new Error(cJson?.error || 'Failed to start chat');
      setChatId(cJson.chatId || null);

      setStatus('streaming'); setNote('Streaming');
      // expose for quick debug
      window.__HEYGEN_DEBUG__ = { token, avatarName, chatId: cJson.chatId || null, client, session };
    } catch (e) {
      console.error(e);
      setStatus('error');
      setNote(e?.message || 'start failed');
      alert(e?.message || 'start failed');
    }
  }

  function endAvatar() {
    try {
      // best-effort: stop any current stream
      if (videoRef.current) {
        const ms = videoRef.current.srcObject;
        if (ms && typeof ms.getTracks === 'function') {
          ms.getTracks().forEach(t => t.stop());
        }
        videoRef.current.srcObject = null;
      }
    } catch {}
    setStatus('ended');
  }

  async function handleSend(e) {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || !chatId) return;

    setInput('');
    setLog(prev => [...prev, { role: 'user', text }]);

    const r = await fetch('/api/retell-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, text })
    });

    const j = await r.json().catch(() => null);
    const reply = j?.reply || '';
    setLog(prev => [...prev, { role: 'assistant', text: reply }]);

    // If mic is off (text mode), optionally speak reply via HeyGen
    if (!mic && reply) {
      try {
        // uses the globally exposed client if present
        const dbg = window.__HEYGEN_DEBUG__;
        if (dbg?.client && typeof dbg.client.speakText === 'function') {
          await dbg.client.speakText(reply);
        }
      } catch (err) {
        console.warn('speakText failed (non-blocking)', err);
      }
    }
  }

  // autostart support: /embed?autostart=1
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get('autostart') === '1') startAvatar();
  }, []);

  return (
    <div style={page}>
      <div style={panel}>
        <div style={badge}>{status} — {note}</div>

        <div style={videoWrap}>
          <video ref={videoRef} autoPlay playsInline muted={muted} style={videoEl} />
          <div style={controls}>
            <button onClick={() => setMuted(v => !v)} style={btn}>
              {muted ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={() => setMic(v => !v)} style={btn}>
              {mic ? 'Mic On' : 'Mic Off'}
            </button>
            {status !== 'streaming' ? (
              <button onClick={startAvatar} style={btnPrimary}>Start</button>
            ) : (
              <button onClick={endAvatar} style={btn}>End</button>
            )}
            <button onClick={() => window.close?.()} style={btn}>Close</button>
          </div>
        </div>

        {/* Text chat area */}
        <div style={chatBox}>
          <div style={chatHeader}>
            <strong>Text Chat</strong>
            <span style={{ opacity: 0.6, fontSize: 12 }}>
              {status === 'streaming' ? 'Streaming' : '—'}
            </span>
          </div>

          <div style={logWrap}>
            {log.map((m, i) => (
              <div key={i} style={m.role === 'user' ? logUser : logAssistant}>
                <span style={bubbleRole}>{m.role === 'user' ? 'You' : 'Assistant'}</span>
                <span>{m.text}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} style={inputRow}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message…"
              style={inputEl}
              disabled={!chatId || status !== 'streaming'}
            />
            <button type="submit" style={sendBtn} disabled={!chatId || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* styles */
const page = { background:'#0b0b0b', color:'#fff', minHeight:'100vh', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'24px' };
const panel = { width: 520, maxWidth:'100%', display:'flex', flexDirection:'column', gap:12 };
const badge = { alignSelf:'flex-start', fontSize:12, padding:'4px 8px', borderRadius:8, background:'#1c1c1c', border:'1px solid #333' };
const videoWrap = { position:'relative', width:'100%', aspectRatio:'3/4', background:'#000', borderRadius:16, overflow:'hidden', border:'1px solid #222' };
const videoEl = { width:'100%', height:'100%', objectFit:'cover' };
const controls = { position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)', display:'flex', gap:8, background:'rgba(0,0,0,0.35)', padding:6, borderRadius:12, backdropFilter:'blur(4px)' };
const btnBase = { padding:'8px 12px', borderRadius:8, border:'1px solid #333', background:'#191919', color:'#fff', cursor:'pointer', fontSize:13 };
const btn = btnBase;
const btnPrimary = { ...btnBase, background:'#1e90ff', borderColor:'#1e90ff' };

const chatBox = { marginTop:12, border:'1px solid #222', borderRadius:12, overflow:'hidden', background:'#101010' };
const chatHeader = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderBottom:'1px solid #1c1c1c' };
const logWrap = { maxHeight:220, overflow:'auto', display:'flex', flexDirection:'column', gap:8, padding:'10px' };
const bubble = { padding:'8px 10px', borderRadius:10, lineHeight:1.35, display:'inline-flex', gap:8 };
const bubbleRole = { opacity:0.6, fontSize:12, minWidth:70, display:'inline-block' };
const logUser = { ...bubble, background:'#141b2c', border:'1px solid #21314a' };
const logAssistant = { ...bubble, background:'#131313', border:'1px solid #262626' };
const inputRow = { display:'flex', gap:6, borderTop:'1px solid #1c1c1c', padding:'8px' };
const inputEl = { flex:1, padding:'10px 12px', borderRadius:8, border:'1px solid #333', background:'#0d0d0d', color:'#fff' };
const sendBtn = { ...btnBase, background:'#2a2a2a' };
