'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadHeygenSdk } from '@/app/lib/loadHeygenSdk';

export default function AvatarChatPanel({ onClose }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [note, setNote] = useState('');
  const [input, setInput] = useState('');

  // keep references around
  const clientRef = useRef(null);
  const sessionRef = useRef(null);
  const stopRef = useRef(() => {});
  const mutedRef = useRef(true);

  async function startAll() {
    try {
      setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
      const HeyGenCtor = await loadHeygenSdk();

      // 1) session token
      const tRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const tJson = await tRes.json();
      const token = tJson?.token;
      if (!token) throw new Error('Token missing from /api/heygen-token');

      // 2) avatar id
      const aRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const aJson = await aRes.json();
      const avatarName = aJson?.id;
      if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

      setStatus('starting'); setNote(`Starting ${avatarName}…`);
      const client = new HeyGenCtor({ token });
      clientRef.current = client;

      const session = await (client.createStartAvatar?.({
        avatarName, quality: 'high', version: 'v3',
      }) ?? client.createStartAvatar?.({ avatarName, quality: 'high' }));

      sessionRef.current = session;

      // Attach stream to <video>
      await attachVideo(client, session, videoRef.current);

      // Autoplay muted to satisfy browser rules
      if (videoRef.current) {
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }

      // 3) Start Retell chat session
      setNote('Starting Retell chat…');
      const r = await fetch('/api/retell-chat/start', { method: 'POST' });
      if (!r.ok) throw new Error(`retell start failed: ${r.status}`);
      const chat = await r.json(); // shape depends on your API route
      // You likely don’t need to handle sockets here because your /send route proxies text to agent.
      // We’ll just keep the minimal text interface.

      setStatus('started'); setNote('Ready! Type something and press “Say”.');

      // Provide a stop cleanup
      stopRef.current = async () => {
        try { await session?.stop?.(); } catch {}
        try { await client?.stop?.(); } catch {}
        clientRef.current = null;
        sessionRef.current = null;
        setStatus('idle'); setNote('Stopped.');
      };
    } catch (e) {
      console.error(e);
      setStatus('error'); setNote(e?.message || 'Failed to start');
      alert(e?.message || 'Failed to start');
    }
  }

  async function say() {
    try {
      const text = input.trim();
      if (!text) return;
      setInput('');

      // Send to Retell (your API should forward it to the active session)
      const r = await fetch('/api/retell-chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      });
      // We also *speak* through the avatar immediately (most agents return near-identical TTS anyway)
      await speakTextThroughAvatar(text);
      if (!r.ok) console.warn('retell send non-200:', r.status);

    } catch (e) {
      console.error(e);
      setNote(e?.message || 'say() failed');
    }
  }

  async function interrupt() {
    const s = sessionRef.current;
    const c = clientRef.current;
    try {
      if (s?.stopSpeaking) await s.stopSpeaking();
      else if (c?.stopSpeaking) await c.stopSpeaking();
    } catch {}
  }

  async function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    mutedRef.current = v.muted;
    setNote(v.muted ? 'Muted' : 'Unmuted');
  }

  async function stopAll() {
    await stopRef.current();
  }

  // Helpers
  async function attachVideo(client, session, videoEl) {
    if (!videoEl) throw new Error('Missing <video> element');

    // 1) built-ins
    if (session?.attachToElement) { await session.attachToElement(videoEl); return; }
    if (client?.attachToElement)  { await client.attachToElement(videoEl);  return; }

    // 2) direct streams
    const direct = [session?.mediaStream, session?.stream, client?.mediaStream, client?.stream].filter(Boolean);
    for (const ms of direct) {
      if (ms instanceof MediaStream) { videoEl.srcObject = ms; return; }
    }

    // 3) common fields
    const vt = session?.videoTrack || session?.video || session?.cameraTrack;
    const at = session?.audioTrack || session?.audio || session?.microphoneTrack;
    const tracks = [vt?.track || vt, at?.track || at].filter(Boolean);
    if (tracks.length) {
      videoEl.srcObject = new MediaStream(tracks);
      return;
    }

    // 4) getters
    for (const g of ['getMediaStream','getStream','getOutputStream']) {
      const ms = await session?.[g]?.();
      if (ms instanceof MediaStream) { videoEl.srcObject = ms; return; }
      const cm = await client?.[g]?.();
      if (cm instanceof MediaStream) { videoEl.srcObject = cm; return; }
    }

    throw new Error('No attach function or MediaStream available');
  }

  async function speakTextThroughAvatar(text) {
    const s = sessionRef.current;
    const c = clientRef.current;
    if (s?.speakText) return s.speakText(text);
    if (c?.speakText) return c.speakText(text);
    if (s?.client?.speakText) return s.client.speakText(text);
    console.warn('No speakText method found on session/client');
  }

  return (
    <div style={panel}>
      <div style={topBar}>
        <div style={{fontWeight:700}}>Wayne · Avatar Coach</div>
        <button onClick={onClose} style={iconBtn}>✕</button>
      </div>

      <div style={statusRow}>
        <span>Status: <strong>{status}</strong></span>
        <span style={{opacity:.8}}>{note}</span>
      </div>

      <div style={videoWrap}>
        <video ref={videoRef} autoPlay playsInline muted style={videoCss} />
      </div>

      <div style={controls}>
        <button onClick={startAll} style={primary}>Start</button>
        <button onClick={stopAll}  style={ghost}>Stop</button>
        <button onClick={toggleMute} style={ghost}>Mute/Unmute</button>
        <button onClick={interrupt} style={ghost}>Interrupt</button>
      </div>

      <div style={inputRow}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Ask Wayne something…"
          style={inputCss}
        />
        <button onClick={say} style={primary}>Say</button>
      </div>
    </div>
  );
}

/* --- styles --- */
const panel = {
  width: 420, maxWidth: 'calc(100vw - 32px)',
  background: '#0f1115', color:'#fff', borderRadius: 16, padding: 14,
  boxShadow: '0 12px 40px rgba(0,0,0,.45)'
};
const topBar = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 };
const statusRow = { display:'flex', gap:12, alignItems:'center', fontSize:12, color:'#cbd5e1', marginBottom: 8 };
const videoWrap = { width:'100%', aspectRatio:'16/9', background:'#000', borderRadius: 12, overflow:'hidden', marginBottom: 10 };
const videoCss = { width:'100%', height:'100%', objectFit:'cover' };
const controls = { display:'flex', gap:8, marginBottom: 10, flexWrap:'wrap' };
const inputRow = { display:'flex', gap:8 };
const inputCss = { flex:1, padding:'10px 12px', borderRadius: 10, border:'1px solid #222', background:'#12151b', color:'#fff' };
const baseBtn = { padding:'10px 14px', borderRadius:10, cursor:'pointer', border:'1px solid transparent' };
const primary = { ...baseBtn, background:'#1e90ff', borderColor:'#1e90ff', color:'#fff' };
const ghost   = { ...baseBtn, background:'transparent', borderColor:'#2a2f3a', color:'#e2e8f0' };
const iconBtn = { ...baseBtn, padding:'6px 10px', background:'transparent', borderColor:'#2a2f3a', color:'#e2e8f0' };
