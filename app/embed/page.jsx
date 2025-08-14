'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

export default function EmbedPage() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading-sdk | starting | streaming | ended | error
  const [note, setNote] = useState('');
  const [muted, setMuted] = useState(true);
  const [micOn, setMicOn] = useState(false);
  const [chat, setChat] = useState([]);
  const [sending, setSending] = useState(false);

  const autostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const u = new URL(window.location.href);
    return u.searchParams.get('autostart') === '1';
  }, []);

  async function startAvatar() {
    try {
      setStatus('loading-sdk');
      setNote('Loading HeyGen SDK…');

      const HeyGenStreamingAvatar = await loadHeygenSdk();

      // 1) fetch session token (NOT API key)
      const tRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const tJson = await tRes.json();
      const token = tJson?.token;
      if (!token) throw new Error('No session token');

      // 2) fetch avatar id (streaming avatar name like Wayne_20240711)
      const aRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const aJson = await aRes.json();
      const avatarName = aJson?.id;
      if (!avatarName) throw new Error('No avatarName');

      window.__HEYGEN_DEBUG__ = { token, avatarName };

      setStatus('starting');
      setNote(`Starting ${avatarName}…`);

      // 3) create client and start session
      const client = new HeyGenStreamingAvatar({ token });
      const session = await client.createStartAvatar({
        avatarName,
        quality: 'high',
        version: 'v3', // ensure v3+
      });

      // 4) Attach remote media to <video>, compatible across builds
      const v = videoRef.current;
      if (!v) throw new Error('missing <video>');

      // Prefer provided helper if present…
      if (typeof client.attachToElement === 'function') {
        await client.attachToElement(v);
      } else if (typeof client.attachElement === 'function') {
        // (some builds used attachElement)
        await client.attachElement(v);
      } else if (typeof client.getRemoteMediaStream === 'function') {
        // (esm builds commonly provide a getter)
        const ms = await client.getRemoteMediaStream();
        if (!(ms instanceof MediaStream)) throw new Error('no MediaStream from getRemoteMediaStream()');
        v.srcObject = ms;
        await v.play().catch(() => {});
      } else if (session && (session.mediaStream || session.stream)) {
        // (older objects hung stream on the session)
        const ms = session.mediaStream || session.stream;
        v.srcObject = ms;
        await v.play().catch(() => {});
      } else {
        throw new Error('No attach function or MediaStream available');
      }

      // Auto-mute video element if our state says muted
      v.muted = muted;

      setStatus('streaming');
      setNote('Streaming');
    } catch (e) {
      console.error(e);
      setStatus('error');
      setNote(e?.message || 'start failed');
    }
  }

  async function endAvatar() {
    try {
      // very light end — refresh is simplest for demos
      setStatus('ended');
      setNote('Ended');
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.pause?.();
      }
    } catch {}
  }

  // Text chat send uses our Retell proxy; if it’s not wired, you’ll see “(no response)”
  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setChat((c) => [...c, { role: 'user', text: trimmed }]);
    setSending(true);
    try {
      // Start (or reuse) chat
      const start = await fetch('/api/retell-chat/start', { method: 'POST' }).then((r) => r.json());
      if (!start?.ok) throw new Error(start?.error || 'retell start failed');

      const reply = await fetch('/api/retell-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: start.chatId, text: trimmed }),
      }).then((r) => r.json());

      const assistant = reply?.text || reply?.message || '(no response)';
      setChat((c) => [...c, { role: 'assistant', text: assistant }]);
    } catch (e) {
      console.error(e);
      setChat((c) => [...c, { role: 'assistant', text: '(no response)' }]);
    } finally {
      setSending(false);
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const nm = !m;
      if (videoRef.current) videoRef.current.muted = nm;
      return nm;
    });
  }

  async function toggleMic() {
    // This just flips the UI; wiring real mic into HeyGen depends on your plan
    setMicOn((m) => !m);
  }

  useEffect(() => {
    if (autostart) startAvatar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostart]);

  return (
    <div style={page}>
      <div style={card}>
        <div style={badge}>{status} — {note}</div>
        <div style={videoWrap}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            style={video}
          />
        </div>

        <div style={btnRow}>
          <button style={btn} onClick={startAvatar} disabled={status === 'streaming' || status === 'starting'}>
            Start
          </button>
          <button style={btn} onClick={toggleMute}>
            {muted ? 'Unmute' : 'Mute'}
          </button>
          <button style={btn} onClick={toggleMic}>
            {micOn ? 'Mic On' : 'Mic Off'}
          </button>
          <button style={btn} onClick={endAvatar}>
            End
          </button>
        </div>

        <div style={chatWrap}>
          <div style={chatHead}>Text Chat <small>(demo)</small></div>
          <div style={chatBody}>
            {chat.map((m, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <b>{m.role}:</b> <span style={{ opacity: 0.9 }}>{m.text}</span>
              </div>
            ))}
          </div>
          <ChatInput disabled={sending} onSend={sendMessage} />
        </div>
      </div>
    </div>
  );
}

function ChatInput({ disabled, onSend }) {
  const [val, setVal] = useState('');
  return (
    <div style={inputRow}>
      <input
        style={input}
        value={val}
        placeholder="Type a message…"
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && val.trim() && !disabled) {
            onSend(val);
            setVal('');
          }
        }}
      />
      <button style={sendBtn} disabled={disabled || !val.trim()} onClick={() => { onSend(val); setVal(''); }}>
        Send
      </button>
    </div>
  );
}

/* ——— styles: compact 360px widget ——— */
const page = {
  minHeight: '100vh',
  background: '#0b0b0b',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '24px 12px'
};
const card = {
  width: 360,
  borderRadius: 14,
  background: '#111',
  color: '#fff',
  boxShadow: '0 8px 28px rgba(0,0,0,.5)',
  padding: 10,
  position: 'relative'
};
const badge = {
  position: 'absolute',
  top: 6,
  left: 12,
  fontSize: 10,
  opacity: 0.8
};
const videoWrap = {
  width: '100%',
  aspectRatio: '3 / 4',
  background: '#000',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid #222'
};
const video = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block'
};
const btnRow = { display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 };
const btn = {
  padding: '6px 10px',
  borderRadius: 8,
  background: '#1f2937',
  border: '1px solid #334155',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12
};
const chatWrap = { marginTop: 10 };
const chatHead = { fontSize: 12, opacity: 0.9, marginBottom: 6 };
const chatBody = {
  height: 90,
  overflow: 'auto',
  borderRadius: 8,
  border: '1px solid #222',
  padding: 8,
  background: '#0f0f0f',
  marginBottom: 6
};
const inputRow = { display: 'flex', gap: 6 };
const input = {
  flex: 1,
  background: '#0f0f0f',
  border: '1px solid #222',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#fff',
  fontSize: 13
};
const sendBtn = {
  padding: '8px 12px',
  borderRadius: 8,
  background: '#2563eb',
  border: '1px solid #1d4ed8',
  color: '#fff',
  fontSize: 13,
  cursor: 'pointer'
};
