'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

// Loader you already have in app/lib
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

function Icon({ name }) {
  // tiny emoji icons so we don’t add libs
  const map = {
    mute: '🔇',
    sound: '🔊',
    mic: '🎤',
    micOff: '🎙️❌',
    stop: '⏹️',
    close: '✖️',
    send: '📤',
  };
  return <span style={{ marginRight: 6 }}>{map[name] || '•'}</span>;
}

export default function Embed() {
  // ---------- basic session state ----------
  const [status, setStatus] = useState('idle'); // idle | loading-sdk | starting | started | ended | error
  const [note, setNote] = useState('');
  const [muted, setMuted] = useState(true);      // start muted
  const [micEnabled, setMicEnabled] = useState(false); // start with mic OFF
  const [autoStart, setAutoStart] = useState(false);

  // ---------- chat + captions ----------
  const [messages, setMessages] = useState([
    { role: 'system', text: 'You can type a message below or turn on the mic.' }
  ]);
  const [input, setInput] = useState('');
  const [captions, setCaptions] = useState(''); // running transcription, if the SDK exposes it

  // ---------- refs ----------
  const videoRef = useRef(null);
  const clientRef = useRef(null);
  const avatarNameRef = useRef('');

  // ---------- helpers ----------
  function pushMsg(role, text) {
    setMessages(prev => [...prev, { role, text }]);
  }

  async function getToken() {
    const r = await fetch('/api/heygen-token', { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET /api/heygen-token failed: ${r.status}`);
    const j = await r.json();
    const token = j?.token;
    if (!token) throw new Error('Token missing from /api/heygen-token');
    return token;
  }

  async function getAvatarName() {
    const r = await fetch('/api/heygen-avatars', { cache: 'no-store' });
    if (!r.ok) throw new Error(`GET /api/heygen-avatars failed: ${r.status}`);
    const j = await r.json();
    const id = j?.id;
    if (!id) throw new Error('Avatar id missing from /api/heygen-avatars');
    return id; // e.g. "Wayne_20240711"
  }

  // ---------- START avatar ----------
  async function startAvatar() {
    try {
      setStatus('loading-sdk');
      setNote('Loading HeyGen SDK…');
      const HeyGenStreamingAvatar = await loadHeygenSdk(); // our loader with fallbacks

      setStatus('starting');
      setNote('Fetching token & avatar…');
      const [token, avatarName] = await Promise.all([getToken(), getAvatarName()]);
      avatarNameRef.current = avatarName;

      // expose for quick debug
      window.__HEYGEN_DEBUG__ = { token, avatarName };

      // 1) create client (use "token", not "access_token")
      const client = new HeyGenStreamingAvatar({ token });
      clientRef.current = client;

      // 2) start avatar (v3+)
      const session = await client.createStartAvatar({
        avatarName,  // e.g. "Wayne_20240711"
        quality: 'high',
        version: 'v3'
      });

      // 3) ATTACH — supports either attachToElement or raw MediaStream
      const maybeAttach = client.attachToElement || session.attachToElement;
      const maybeStream = client.mediaStream || session.mediaStream;

      if (maybeAttach && videoRef.current) {
        await maybeAttach.call(client, videoRef.current);
      } else if (maybeStream && videoRef.current) {
        videoRef.current.srcObject = maybeStream;
        await videoRef.current.play().catch(() => {});
      } else {
        throw new Error('No attach function or MediaStream available');
      }

      // 4) initial mute state
      if (videoRef.current) videoRef.current.muted = true; // start muted
      setMuted(true);

      // 5) optional: wire caption/transcript if the SDK exposes events
      try {
        const onAny = client.on?.bind(client) || session.on?.bind(session);
        if (onAny) {
          onAny('transcript', (t) => {
            if (typeof t === 'string') setCaptions(t);
            else if (t?.text) setCaptions(t.text);
          });
          onAny('message', (m) => {
            // generic “assistant said something” hook, if present
            if (typeof m === 'string') pushMsg('assistant', m);
            else if (m?.text) pushMsg('assistant', m.text);
          });
        }
      } catch { /* no-op */ }

      setStatus('started');
      setNote('Streaming');

      // optional hello (text only)
      // if (client.speakText) await client.speakText("Hello! How can I help?");
    } catch (err) {
      console.error(err);
      setStatus('error');
      setNote(err?.message || 'Start failed');
      alert(err?.message || 'Start failed');
    }
  }

  // ---------- controls ----------
  function toggleMute() {
    setMuted(v => {
      const next = !v;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }

  async function toggleMic() {
    const next = !micEnabled;

    if (next) {
      // turning mic ON → ensure we got permission at least once
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // don’t keep a page-level stream open; let SDK own it if it wants
        stream.getTracks().forEach(t => t.stop());
      } catch (e) {
        alert('Microphone permission denied.');
        return;
      }
    }

    setMicEnabled(next);

    const client = clientRef.current;
    if (!client) return;

    // Try SDK helpers if they exist
    try {
      if (!next && client.disableMic) return client.disableMic();
      if (next && client.enableMic) return client.enableMic();
    } catch {}

    // Fallback: toggle any local audio tracks the SDK exposes
    try {
      const tracks = await client.getLocalAudioTracks?.();
      if (Array.isArray(tracks) && tracks.length) {
        tracks.forEach(t => (t.enabled = next));
      }
    } catch {}
  }

  async function endSession() {
    try {
      const client = clientRef.current;
      if (client?.stop) await client.stop();
    } catch {}
    clientRef.current = null;
    setStatus('ended');
    setNote('Ended');
    setCaptions('');
  }

  // ---------- text chat ----------
  async function sendText() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    pushMsg('user', text);

    const client = clientRef.current;
    if (!client) {
      pushMsg('system', 'Avatar is not started yet.');
      return;
    }

    // Prefer the SDK’s TTS → mouth sync
    if (client.speakText) {
      try {
        await client.speakText(text);
        // Some SDKs also emit “message” events; if not, still show it
        pushMsg('assistant', `(speaking) ${text}`);
      } catch (e) {
        console.error(e);
        pushMsg('system', 'Failed to send text to avatar.');
      }
      return;
    }

    // Fallback: show message only
    pushMsg('assistant', text);
  }

  // ---------- autostart ----------
  useEffect(() => {
    const url = new URL(window.location.href);
    const auto = url.searchParams.get('autostart') === '1';
    setAutoStart(auto);
  }, []);
  useEffect(() => { if (autoStart) startAvatar(); }, [autoStart]);

  // ---------- layout ----------
  const badge = useMemo(() => {
    const map = {
      idle: 'idle',
      'loading-sdk': 'Loading SDK…',
      starting: `Starting ${avatarNameRef.current || 'avatar'}…`,
      started: 'Streaming',
      ended: 'Ended',
      error: 'Error',
    };
    return map[status] || status;
  }, [status]);

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.badge}><strong>{status}</strong>{status === 'started' ? ' — Streaming' : ''}</div>

        <div style={styles.videoShell}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            style={styles.video}
          />
          {/* Overlay controls */}
          <div style={styles.overlay}>
            {status !== 'started' ? (
              <button style={styles.cta} onClick={startAvatar}>Start</button>
            ) : (
              <div style={styles.controlsRow}>
                <button onClick={toggleMute} style={styles.btn}>
                  <Icon name={muted ? 'mute' : 'sound'} />
                  {muted ? 'Muted' : 'Sound On'}
                </button>

                <button onClick={toggleMic} style={styles.btn}>
                  <Icon name={micEnabled ? 'mic' : 'micOff'} />
                  {micEnabled ? 'Mic On' : 'Mic Off'}
                </button>

                <button onClick={endSession} style={styles.btn}>
                  <Icon name="stop" />
                  End
                </button>

                <button onClick={() => window.parent?.postMessage({ type: 'close-embed' }, '*')} style={styles.btn}>
                  <Icon name="close" />
                  Close
                </button>
              </div>
            )}

            {/* Captions strip (if SDK emits) */}
            {captions ? (
              <div style={styles.captions}>{captions}</div>
            ) : null}
          </div>
        </div>

        {/* Text chat panel */}
        <div style={styles.chatCard}>
          <div style={styles.chatHeader}>
            <div>Text Chat</div>
            <div style={{ opacity: 0.7, fontSize: 12 }}>{badge}</div>
          </div>
          <div style={styles.chatScroll} id="chat-scroll">
            {messages.map((m, i) => (
              <div key={i} style={{ ...styles.msg, ...(m.role === 'user' ? styles.msgUser : m.role === 'assistant' ? styles.msgAssistant : styles.msgSystem)}}>
                <b style={{ marginRight: 8 }}>
                  {m.role === 'user' ? 'You' : m.role === 'assistant' ? 'Avatar' : 'System'}
                </b>
                <span>{m.text}</span>
              </div>
            ))}
          </div>
          <div style={styles.chatInputRow}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Type a message…"
              style={styles.input}
              onKeyDown={e => { if (e.key === 'Enter') sendText(); }}
            />
            <button onClick={sendText} style={styles.sendBtn}><Icon name="send" />Send</button>
          </div>
        </div>

        {/* status note */}
        <div style={styles.note}>{note}</div>
      </div>
    </div>
  );
}

// ---------- styles ----------
const styles = {
  page: {
    background: '#0b0b0b',
    color: '#fff',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    display: 'grid',
    placeItems: 'center',
    padding: 16
  },
  wrap: { width: 'min(960px, 95vw)' },
  badge: {
    position: 'relative',
    top: 8,
    left: 8,
    display: 'inline-block',
    padding: '6px 10px',
    background: '#1f1f1f',
    border: '1px solid #333',
    borderRadius: 8,
    fontSize: 12,
    marginBottom: 8
  },
  videoShell: {
    position: 'relative',
    width: '100%',
    aspectRatio: '3/4',
    background: '#000',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: 16,
    pointerEvents: 'none'
  },
  controlsRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    pointerEvents: 'auto'
  },
  btn: {
    padding: '10px 14px',
    background: 'rgba(30,30,30,0.85)',
    border: '1px solid #444',
    borderRadius: 20,
    color: '#fff',
    cursor: 'pointer'
  },
  cta: {
    alignSelf: 'center',
    marginBottom: 16,
    padding: '12px 18px',
    background: '#1e90ff',
    border: '1px solid #1e90ff',
    borderRadius: 22,
    color: '#fff',
    cursor: 'pointer',
    pointerEvents: 'auto'
  },
  captions: {
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
    background: 'rgba(0,0,0,0.7)',
    padding: '6px 10px',
    borderRadius: 10,
    fontSize: 14,
    pointerEvents: 'none'
  },
  chatCard: {
    marginTop: 16,
    background: '#121212',
    border: '1px solid #2a2a2a',
    borderRadius: 12,
    overflow: 'hidden'
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid #222',
    background: '#0f0f0f'
  },
  chatScroll: {
    maxHeight: 220,
    overflow: 'auto',
    padding: 12,
    display: 'grid',
    gap: 8
  },
  msg: {
    padding: '8px 10px',
    borderRadius: 10,
    fontSize: 14
  },
  msgUser: { background: '#1d2a40' },
  msgAssistant: { background: '#1f4021' },
  msgSystem: { background: '#2a2a2a', fontStyle: 'italic' },
  chatInputRow: {
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: '1px solid #222',
    background: '#0f0f0f'
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #333',
    background: '#0e0e0e',
    color: '#fff',
    outline: 'none'
  },
  sendBtn: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #1e90ff',
    background: '#1e90ff',
    color: '#fff',
    cursor: 'pointer'
  },
  note: { marginTop: 8, opacity: 0.75, fontSize: 12 }
};
