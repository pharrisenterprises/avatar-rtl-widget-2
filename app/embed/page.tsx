'use client';

import { useEffect, useRef, useState } from 'react';
import StreamingAvatar, { StreamingEvents, AvatarQuality, TaskType } from '@heygen/streaming-avatar';

type BuildStatus = 'idle' | 'starting' | 'ready' | 'error';
type MicStatus = 'unsupported' | 'idle' | 'listening';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const MIC_AUTO_TIMEOUT_MS = 30_000; // 30s

export default function EmbedAvatar() {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [chatId, setChatId] = useState<string>('');
  const [muted, setMuted] = useState<boolean>(true); // start muted for autoplay
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [captions, setCaptions] = useState<string[]>([]);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [interim, setInterim] = useState<string>('');
  const [finalText, setFinalText] = useState<string>('');
  const [micAvailable, setMicAvailable] = useState<boolean>(false);
  const [loadingMic, setLoadingMic] = useState<boolean>(false);
  const [streamReady, setStreamReady] = useState<boolean>(false);

  const avatarRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const autoSendTimerRef = useRef<number | null>(null);
  const autoStopMicTimerRef = useRef<number | null>(null);
  const keepAliveRef = useRef<number | null>(null);

  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  const shell: React.CSSProperties = {
    width: '100%', height: '100%', background: '#000', color: '#fff',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    position: 'relative', overflow: 'hidden'
  };

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setMicAvailable(!!SR);
    setMicStatus(SR ? 'idle' : 'unsupported');
  }, []);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = muted ? 0 : 1;
    }
  }, [muted]);

  function pushCaption(line: string) {
    if (!line) return;
    setCaptions(prev => [...prev.slice(-8), line]);
  }

  function enqueueToSpeak(text: string) {
    const t = (text || '').trim();
    if (!t) return;
    speakQueueRef.current.push(t);
    drainSpeakQueue().catch(() => {});
  }
  async function drainSpeakQueue() {
    const a = avatarRef.current;
    if (!a || speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length) {
        const next = speakQueueRef.current.shift();
        if (!next) continue;
        await a.speak({ text: next, task_type: TaskType.REPEAT } as any);
        pushCaption(next);
      }
    } finally { speakingRef.current = false; }
  }

  // Auto-start session on mount (so the moment the widget opens, avatar warms up)
  useEffect(() => {
    (async () => {
      if (status !== 'idle') return;
      try {
        setStatus('starting');
        const r1 = await fetch('/api/retell-chat/start', { method: 'POST' });
        if (!r1.ok) throw new Error('Chat start failed: ' + r1.status);
        const { chat_id } = await r1.json();
        setChatId(chat_id);

        const r2 = await fetch('/api/heygen-token', { method: 'POST' });
        if (!r2.ok) throw new Error('HeyGen token failed: ' + r2.status);
        const { token } = await r2.json();
        if (!token) throw new Error('No token returned');

        const a = new StreamingAvatar({ token });

        a.on(StreamingEvents.STREAM_READY, (evt: any) => {
          const stream: MediaStream = evt.detail;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true; // helps autoplay
            videoRef.current.play().catch(() => {});
          }
          setStreamReady(true);
          // Tell parent widget the stream is ready (optional)
          try {
            window.parent?.postMessage({ type: 'ai:stream-ready' }, '*');
          } catch {}
        });

        const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
        const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
        const opts: any = { quality: AvatarQuality.High };
        if (voiceId) opts.voice = { voiceId };
        if (avatarName) opts.avatarName = avatarName;

        await a.createStartAvatar(opts).catch((e: any) => {
          pushCaption('❌ createStartAvatar error: ' + (e?.message || e));
          throw e;
        });

        avatarRef.current = a;

        // Keepalive ping
        keepAliveRef.current = window.setInterval(() => {
          if (!chatId) return;
          fetch('/api/retell-chat/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, content: ' ' })
          }).catch(() => {});
        }, 25_000);

        setStatus('ready');
      } catch (e: any) {
        console.error(e);
        pushCaption('❌ Start failed: ' + (e?.message || e));
        setStatus('error');
      }
    })();

    return () => {
      if (keepAliveRef.current) { window.clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    };
  }, [status, chatId]);

  async function sendTextToAgent(text: string) {
    if (!chatId || !avatarRef.current) return;
    const trimmed = text.trim(); if (!trimmed) return;

    async function sendOnce() {
      const r = await fetch('/api/retell-chat/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, content: trimmed })
      });
      if (!r.ok) throw new Error('send fail ' + r.status);
      const data = await r.json();
      return (data?.text || '').trim();
    }

    let agentText = '';
    try { agentText = await sendOnce(); } catch {}
    if (!agentText) { await new Promise(r => setTimeout(r, 700)); try { agentText = await sendOnce(); } catch {} }
    if (agentText) { enqueueToSpeak(agentText); await drainSpeakQueue(); }
  }

  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    return rec;
  }

  function startMic() {
    if (micStatus === 'unsupported' || micStatus === 'listening') return;
    setLoadingMic(true);
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        const rec = initRecognition();
        if (!rec) { setMicStatus('unsupported'); setLoadingMic(false); return; }
        setInterim(''); setFinalText('');
        recognitionRef.current = rec;

        rec.onresult = (evt: any) => {
          let interimAgg = '', finalAgg = '';
          for (let i = evt.resultIndex; i < evt.results.length; i++) {
            const res = evt.results[i];
            const txt = res[0]?.transcript || '';
            if (res.isFinal) finalAgg += txt + ' ';
            else interimAgg += txt + ' ';
          }
          setInterim(interimAgg.trim());
          if (finalAgg.trim()) {
            const clean = finalAgg.trim();
            setFinalText((prev) => (prev ? prev + ' ' + clean : clean));
            if (autoSendTimerRef.current) window.clearTimeout(autoSendTimerRef.current);
            autoSendTimerRef.current = window.setTimeout(async () => {
              setFinalText((prev) => {
                const payload = (prev + ' ').trim();
                if (payload) void sendTextToAgent(payload);
                return '';
              });
              setInterim('');
            }, 600);
          }
        };

        rec.onerror = () => {};
        rec.onend = () => { setMicStatus('idle'); };

        rec.start();
        setMicStatus('listening');
        setLoadingMic(false);

        // safe to unmute after a user gesture (mic click)
        setMuted(false);

        if (autoStopMicTimerRef.current) window.clearTimeout(autoStopMicTimerRef.current);
        autoStopMicTimerRef.current = window.setTimeout(() => { stopMic(true); }, MIC_AUTO_TIMEOUT_MS);
      })
      .catch(() => { setMicStatus('unsupported'); setLoadingMic(false); });
  }

  function stopMic(sendLeftover = true) {
    const rec = recognitionRef.current;
    if (rec) { try { rec.stop(); } catch {} recognitionRef.current = null; }
    if (autoSendTimerRef.current) { window.clearTimeout(autoSendTimerRef.current); autoSendTimerRef.current = null; }
    if (autoStopMicTimerRef.current) { window.clearTimeout(autoStopMicTimerRef.current); autoStopMicTimerRef.current = null; }
    const leftover = (finalText + ' ' + interim).trim();
    setInterim(''); setFinalText('');
    if (sendLeftover && leftover) void sendTextToAgent(leftover);
    setMicStatus('idle');
  }

  function goFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  const btn = (style: React.CSSProperties) => ({
    background: 'rgba(20,20,20,0.75)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontSize: 14, ...style
  });

  // Poster (covers black gap until streamReady)
  const Poster = (
    <div style={{
      position:'absolute', inset:0,
      background:'linear-gradient(180deg, #111 0%, #1b1b1b 100%)',
      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column'
    }}>
      <div style={{width:64, height:64, borderRadius:'50%', border:'3px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', animation:'spin 1s linear infinite'}} />
      <div style={{marginTop:14, opacity:0.8}}>Warming up avatar…</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={shell}>
      {/* Show poster until the stream is actually ready */}
      {!streamReady && Poster}

      {/* Video appears as soon as stream is ready */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width:'100%', height:'100%', objectFit:'cover',
          opacity: streamReady ? 1 : 0, transition:'opacity .25s ease'
        }}
      />

      {(status !== 'ready' || loadingMic) && streamReady && (
        <div style={{
          position:'absolute', inset:0, backdropFilter:'blur(2px)',
          background:'rgba(0,0,0,0.25)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
        }}>
          {status !== 'ready' ? 'Starting session…' : 'Hang tight… opening microphone'}
        </div>
      )}

      <div style={{position:'absolute', left:10, top:10, fontSize:12, opacity:0.7}}>Status: {status}</div>

      <div style={{ position:'absolute', right:10, top:10, display:'flex', gap:6 }}>
        <button onClick={() => setMuted(m => !m)} style={btn({})} aria-label="Mute/unmute">
          {muted ? '🔇' : '🔊'}
        </button>
        <button onClick={goFullscreen} style={btn({})} aria-label="Fullscreen">⤢</button>
        <button onClick={() => setShowChat(v => !v)} style={btn({})} aria-label="Chat">💬</button>
      </div>

      <div style={{ position:'absolute', left:0, right:0, bottom:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, flexWrap:'wrap' }}>
        <button
          onClick={micStatus === 'listening' ? () => stopMic(true) : startMic}
          disabled={!micAvailable || status !== 'ready'}
          style={btn({ fontWeight:600 })}
          title={micAvailable ? 'Start microphone' : 'Use Chrome/Edge for mic speech'}
        >
          {micStatus === 'unsupported' ? 'Mic not supported' : micStatus === 'listening' ? 'Stop Mic' : 'Start Mic'}
        </button>

        <div style={{
          maxWidth:'80%', minWidth:220, background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.12)',
          padding:'8px 10px', borderRadius:10, fontSize:14, lineHeight:1.35, maxHeight:96, overflow:'auto'
        }}>
          {captions.length === 0 ? <span style={{opacity:0.6}}>Captions…</span> :
            captions.slice(-3).map((c,i) => <div key={i} style={{margin:'4px 0'}}>• {c}</div>)}
        </div>
      </div>

      {showChat && (
        <div style={{
          position:'absolute', right:10, bottom:68, width:300,
          background:'rgba(15,15,15,0.95)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:12, padding:10
        }}>
          <div style={{display:'flex', gap:6}}>
            <input
              placeholder="Type a message"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) { await sendTextToAgent(v); (e.target as HTMLInputElement).value=''; }
                }
              }}
              style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid #333', background:'#101010', color:'#fff' }}
              disabled={status !== 'ready'}
            />
            <button
              onClick={async (e) => {
                const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
                const v = input?.value?.trim();
                if (v) { await sendTextToAgent(v); input.value=''; }
              }}
              style={btn({})}
              disabled={status !== 'ready'}
            >Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
