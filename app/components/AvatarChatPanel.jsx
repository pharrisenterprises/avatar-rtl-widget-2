'use client';

import React, { useEffect, useRef, useState } from 'react';
import { loadHeygenSdk } from '@/app/lib/loadHeygenSdk';

export default function AvatarChatPanel({ onClose }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState<'prestart'|'starting'|'started'|'error'>('prestart');
  const [note, setNote] = useState('');
  const [input, setInput] = useState('');

  // refs to keep SDK objects around
  const clientRef = useRef(null);
  const sessionRef = useRef(null);
  const stopRef = useRef(() => {});
  const mutedRef = useRef(true);

  // ---------- Start flows ----------
  async function startVoice() {
    try {
      // Ask for mic permission *before* we start (so users choose voice on purpose)
      await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
        throw new Error('Microphone permission denied.');
      });
      await startAll({ mode: 'voice' });
    } catch (e) {
      setPhase('error'); setNote(e?.message || 'Failed to start with voice');
      alert(e?.message || 'Failed to start with voice');
    }
  }

  async function startTextOnly() {
    await startAll({ mode: 'text' });
  }

  async function startAll({ mode }) {
    try {
      setPhase('starting'); setNote('Loading HeyGen SDK…');
      const HeyGenCtor = await loadHeygenSdk();

      // 1) token
      const tRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const tJson = await tRes.json();
      const token = tJson?.token;
      if (!token) throw new Error('Token missing from /api/heygen-token');

      // 2) avatar id
      const aRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const aJson = await aRes.json();
      const avatarName = aJson?.id;
      if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

      setNote(`Starting ${avatarName}…`);
      const client = new HeyGenCtor({ token });
      clientRef.current = client;

      const session = await (client.createStartAvatar?.({
        avatarName,
        quality: 'high',
        version: 'v3'
      }) ?? client.createStartAvatar?.({ avatarName, quality: 'high' }));

      sessionRef.current = session;

      // Attach video
      await attachVideo(client, session, videoRef.current);

      // Autoplay muted to satisfy browser policies
      if (videoRef.current) {
        videoRef.current.muted = true;
        await videoRef.current.play().catch(()=>{});
        mutedRef.current = true;
      }

      // 3) Start Retell session on server (your route owns the actual Retell logic)
      setNote('Starting Retell chat…');
      const r = await fetch('/api/retell-chat/start', { method: 'POST' });
      if (!r.ok) throw new Error(`retell start failed: ${r.status}`);

      setPhase('started');
      setNote(mode === 'voice' ? 'Voice mode ready' : 'Text-only mode ready');

      // Provide stop cleanup
      stopRef.current = async () => {
        try { await session?.stop?.(); } catch {}
        try { await client?.stop?.(); } catch {}
        clientRef.current = null;
        sessionRef.current = null;
        setPhase('prestart'); setNote('Stopped.');
      };
    } catch (e) {
      console.error(e);
      setPhase('error'); setNote(e?.message || 'Failed to start');
      alert(e?.message || 'Failed to start');
    }
  }

  // ---------- Actions ----------
  async function say() {
    try {
      const text = input.trim();
      if (!text) return;
      setInput('');

      // Send text to your agent
      const r = await fetch('/api/retell-chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!r.ok) console.warn('retell send non-200:', r.status);

      // Speak through the avatar: echo user text or (preferred) agent reply
      // If you modify your /send route to return assistant text, replace `text` with that.
      await speakTextThroughAvatar(text);
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

  // ---------- Helpers ----------
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

  // ---------- UI ----------
  const overlay = (
    <div style={overlayWrap}>
      <div style={overlayBtns}>
        {phase === 'prestart' && (
          <>
            <button onClick={startVoice} style={primary}>Start (Voice)</button>
            <button onClick={startTextOnly} style={ghost}>Start (Text-only)</button>
          </>
        )}
        {phase === 'started' && (
          <>
            <button onClick={toggleMute} style={ghost}>{/* shows mute toggle */}Mute / Unmute</button>
            <button onClick={interrupt} style={ghost}>Interrupt</button>
            <button onClick={stopAll} style={ghost}>Stop</button>
          </>
        )}
      </div>
      <div style={overlayNote}>{note}</div>
    </div>
  );

  return (
    <div style={panel}>
      <div style={topBar}>
        <div style={{fontWeight:700}}>Wayne · Avatar Coach</div>
        <button onClick={onClose} style={iconBtn}>✕</button>
      </div>

      <div style={videoWrap}>
        <video ref={videoRef} autoPlay playsInline muted style={videoCss} />
        {overlay}
      </div>

      <div style={inputRow}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Type to speak (works in text-only too)…"
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

const videoWrap = { position:'relative', width:'100%', aspectRatio:'16/9', background:'#000', borderRadius: 12, overflow:'hidden', marginBottom: 10 };
const videoCss = { width:'100%', height:'100%', objectFit:'cover' };

const overlayWrap = { position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'space-between', pointerEvents:'none' };
const overlayBtns = { display:'flex', gap:8, padding:10, justifyContent:'flex-end', pointerEvents:'auto' };
const overlayNote = { padding:'8px 12px', fontSize:12, background:'rgba(0,0,0,.45)', alignSelf:'flex-start', margin:10, borderRadius:8 };

const inputRow = { display:'flex', gap:8 };
const inputCss = { flex:1, padding:'10px 12px', borderRadius: 10, border:'1px solid #222', background:'#12151b', color:'#fff' };

const baseBtn = { padding:'10px 14px', borderRadius:10, cursor:'pointer', border:'1px solid transparent' };
const primary = { ...baseBtn, background:'#1e90ff', borderColor:'#1e90ff', color:'#fff' };
const ghost   = { ...baseBtn, background:'rgba(0,0,0,.35)', borderColor:'#2a2f3a', color:'#e2e8f0' };
const iconBtn = { ...baseBtn, padding:'6px 10px', background:'transparent', borderColor:'#2a2f3a', color:'#e2e8f0' };
