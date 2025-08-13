'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

const btn = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #333',
  background: '#222',
  color: '#fff',
  cursor: 'pointer'
};
const pill = {
  position: 'absolute',
  top: 8,
  left: 8,
  fontSize: 12,
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: 999
};

export default function EmbedPage() {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle|loading-sdk|ready|starting|started|ended|error
  const [note, setNote] = useState('');
  const [muted, setMuted] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [chatId, setChatId] = useState('');
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant'|'system', text:''}

  const autostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const u = new URL(window.location.href);
    return u.searchParams.get('autostart') === '1';
  }, []);

  // Boot
  useEffect(() => {
    (async () => {
      try {
        setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
        const HeyGenStreamingAvatar = await loadHeygenSdk();

        // get HeyGen session token
        const tk = await fetch('/api/heygen-token', { cache: 'no-store' }).then(r => r.json());
        if (!tk?.ok || !tk?.token) throw new Error('Token missing');
        const token = tk.token;

        const av = await fetch('/api/heygen-avatars', { cache: 'no-store' }).then(r => r.json());
        if (!av?.ok || !av?.id) throw new Error('Avatar id missing');
        const avatarName = av.id;

        // Prepare client
        const c = new HeyGenStreamingAvatar({ token });
        window.__AVATAR__ = c; // for quick dev poking

        // Pre-start state
        setStatus('ready'); setNote(`Ready (avatar=${avatarName})`);

        if (autostart) {
          await startAvatar(c, avatarName);
        }
      } catch (e) {
        setStatus('error'); setNote(e?.message || 'Failed boot');
        // eslint-disable-next-line no-console
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startAvatar(client, avatarName) {
    try {
      const c = client || window.__AVATAR__;
      if (!c) throw new Error('No client');

      setStatus('starting'); setNote('Starting…');

      // Start session v3, high quality
      const session = await c.createStartAvatar({ avatarName, quality: 'high', version: 'v3' });

      // attach remote stream to <video>
      if (!videoRef.current) throw new Error('Missing <video>');
      const ms = await c.attachToElement(videoRef.current);
      if (!ms) throw new Error('No attach function or MediaStream available');

      // Start Retell chat
      const st = await fetch('/api/retell-chat/start').then(r => r.json());
      if (!st?.ok) throw new Error('Retell start failed');
      setChatId(st.chatId || '');

      setStatus('started'); setNote('Streaming');
    } catch (e) {
      setStatus('error'); setNote(e?.message || 'Start failed');
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  async function endAvatar() {
    try {
      const c = window.__AVATAR__;
      if (c?.stop) await c.stop();
    } catch {}
    setStatus('ended'); setNote('Ended');
  }

  function toggleMute() {
    setMuted(v => {
      const nv = !v;
      if (videoRef.current) videoRef.current.muted = nv;
      return nv;
    });
  }

  async function toggleMic() {
    try {
      const c = window.__AVATAR__;
      // The HeyGen SDK controls mic when capturing local audio. Many apps leave mic off for privacy.
      // If your flow requires upstream mic (bi-directional), add the SDK controls here.
      setMicOn(v => !v);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('mic toggle not wired', e);
    }
  }

  async function sendText(e) {
    e?.preventDefault?.();
    const form = e?.target?.closest?.('form') || document.getElementById('textForm');
    const input = form?.querySelector?.('input[name="text"]');
    const text = (input?.value || '').trim();
    if (!text) return;
    input.value = '';

    setMessages(m => [...m, { role: 'user', text }]);

    let reply = '';
    try {
      const r = await fetch('/api/retell-chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, text })
      }).then(r => r.json());
      if (!r?.ok) throw new Error('send failed');
      reply = r.reply || '';
    } catch (e) {
      reply = '(no response)';
    }
    if (reply) setMessages(m => [...m, { role: 'assistant', text: reply }]);

    // speak back with HeyGen
    try {
      const c = window.__AVATAR__;
      if (reply && c?.speakText) {
        await c.speakText(reply);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('speakText failed', e?.message || e);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b0b0b', color: '#fff', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ margin: '0 auto', maxWidth: 820 }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: '#000', borderRadius: 16, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
          <div style={pill}>{status} — {note}</div>
          <video ref={videoRef} autoPlay playsInline muted={muted} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {status !== 'started' && (
              <button style={btn} onClick={() => startAvatar(null, null)}>Start</button>
            )}
            <button style={btn} onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
            <button style={btn} onClick={toggleMic}>{micOn ? 'Mic On' : 'Mic Off'}</button>
            <button style={btn} onClick={endAvatar}>End</button>
          </div>
        </div>

        {/* Text chat panel */}
        <div style={{ marginTop: 14, padding: 12, border: '1px solid #222', borderRadius: 12, background: '#101010' }}>
          <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 8 }}>
            Text Chat <span style={{ opacity: 0.6 }}>({status})</span>
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto', padding: 8, borderRadius: 8, background: '#0a0a0a', border: '1px solid #222', marginBottom: 8 }}>
            {messages.length === 0 && (
              <div style={{ opacity: 0.6, fontSize: 14 }}>System: type a message below or turn on the mic.</div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ margin: '6px 0', fontSize: 14 }}>
                <span style={{ opacity: 0.6 }}>{m.role}:</span>{' '}
                <span>{m.text}</span>
              </div>
            ))}
          </div>

          <form id="textForm" onSubmit={sendText} style={{ display: 'flex', gap: 8 }}>
            <input name="text" placeholder="Type a message…" autoComplete="off"
              style={{ flex: 1, background: '#0b0b0b', color: '#fff', border: '1px solid #222', borderRadius: 8, padding: '10px 12px' }} />
            <button style={btn} type="submit">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}
