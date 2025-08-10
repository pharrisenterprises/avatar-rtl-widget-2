'use client';

import { useEffect, useRef, useState } from 'react';
import StreamingAvatar, {
  StreamingEvents,
  AvatarQuality,
  TaskType,
} from '@heygen/streaming-avatar';

type BuildStatus = 'idle' | 'starting' | 'ready' | 'error';
type MicStatus = 'unsupported' | 'idle' | 'listening';

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

export default function EmbedAvatar() {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [chatId, setChatId] = useState<string>('');
  const [captions, setCaptions] = useState<string[]>([]);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [interim, setInterim] = useState<string>('');
  const [finalText, setFinalText] = useState<string>('');
  const [micAvailable, setMicAvailable] = useState<boolean>(false);

  const avatarRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const autoSendTimerRef = useRef<number | null>(null);
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // minimal, compact styles for embed
  const shell: React.CSSProperties = {
    width: 360,
    height: 560,
    boxSizing: 'border-box',
    padding: 10,
    background: '#0b0b0b',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  };

  // Speech support check
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) { setMicAvailable(true); setMicStatus('idle'); }
    else { setMicAvailable(false); setMicStatus('unsupported'); }
  }, []);

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
        setCaptions((prev) => [...prev.slice(-8), next]);
      }
    } finally { speakingRef.current = false; }
  }

  async function startAll() {
    try {
      setStatus('starting');

      // Start Retell Chat (no audio)
      const r1 = await fetch('/api/retell-chat/start', { method: 'POST' });
      if (!r1.ok) throw new Error('Chat start failed');
      const { chat_id } = await r1.json();
      setChatId(chat_id);

      // Start HeyGen
      const r2 = await fetch('/api/heygen-token', { method: 'POST' });
      if (!r2.ok) throw new Error('HeyGen token failed');
      const { token } = await r2.json();

      const a = new StreamingAvatar({ token });
      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = false;
          videoRef.current.volume = 1;
          videoRef.current.play().catch(() => {});
        }
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';
      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      avatarRef.current = a;

      setStatus('ready');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }

  async function sendTextToAgent(text: string) {
    if (!chatId || !avatarRef.current) return;
    const r = await fetch('/api/retell-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, content: text })
    });
    const data = await r.json();
    const agentText = (data?.text || '').trim();
    if (agentText) { enqueueToSpeak(agentText); await drainSpeakQueue(); }
  }

  // Web Speech (mic)
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
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        const rec = initRecognition();
        if (!rec) { setMicStatus('unsupported'); return; }
        setInterim(''); setFinalText('');
        recognitionRef.current = rec;

        rec.onresult = (evt: any) => {
          let interimAgg = '';
          let finalAgg = '';
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
      })
      .catch(() => setMicStatus('unsupported'));
  }

  function stopMic(sendLeftover = true) {
    const rec = recognitionRef.current;
    if (rec) { try { rec.stop(); } catch {} recognitionRef.current = null; }
    if (autoSendTimerRef.current) { window.clearTimeout(autoSendTimerRef.current); autoSendTimerRef.current = null; }
    const leftover = (finalText + ' ' + interim).trim();
    setInterim(''); setFinalText('');
    if (sendLeftover && leftover) void sendTextToAgent(leftover);
    setMicStatus('idle');
  }

  return (
    <div style={shell}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 600 }}>Assistant</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Status: {status}</div>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: 202, background: '#000', borderRadius: 10 }}
      />

      {/* Controls */}
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        <button
          onClick={startAll}
          disabled={status === 'starting' || status === 'ready'}
          style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer' }}
        >
          {status === 'ready' ? 'Ready' : 'Start'}
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            placeholder="Type a message"
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                const target = e.target as HTMLInputElement;
                const v = target.value.trim();
                if (v) { await sendTextToAgent(v); target.value = ''; }
              }
            }}
            style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #333', background: '#151515', color: '#fff' }}
            disabled={status !== 'ready'}
          />
          <button
            onClick={async (e) => {
              const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
              const v = input?.value?.trim();
              if (v) { await sendTextToAgent(v); input.value = ''; }
            }}
            disabled={status !== 'ready'}
            style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
          >
            Send
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={micStatus === 'listening' ? () => stopMic(true) : startMic}
            disabled={!micAvailable || status !== 'ready'}
            style={{ padding: '8px 12px', borderRadius: 8, cursor: (micAvailable && status==='ready') ? 'pointer' : 'not-allowed' }}
            title={micAvailable ? '' : 'Use Chrome/Edge for mic speech'}
          >
            {micStatus === 'unsupported' ? 'Mic not supported' :
             micStatus === 'listening' ? 'Stop Mic' : 'Start Mic'}
          </button>
        </div>
      </div>

      {/* Captions */}
      <div style={{ marginTop: 10, background: '#111', borderRadius: 8, padding: 10, height: 110, overflow: 'auto', fontSize: 14, lineHeight: 1.45 }}>
        <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Captions</div>
        {captions.length === 0 ? (
          <div style={{ opacity: 0.6 }}>…waiting</div>
        ) : (
          captions.map((c, i) => <div key={i} style={{ margin: '4px 0' }}>• {c}</div>)
        )}
      </div>

      {/* Mic debug (tiny) */}
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
        Mic: {micStatus}{!micAvailable ? ' (use Chrome/Edge)' : ''}
        {interim ? <div style={{ color: '#9ad' }}>Interim: {interim}</div> : null}
      </div>
    </div>
  );
}
