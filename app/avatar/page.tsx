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

export default function AvatarPage() {
  const [status, setStatus] = useState<BuildStatus>('idle');
  const [msg, setMsg] = useState('Click Start to init chat + avatar.');
  const [chatId, setChatId] = useState<string>('');
  const [captions, setCaptions] = useState<string[]>([]);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [interim, setInterim] = useState<string>('');
  const [finalText, setFinalText] = useState<string>('');
  const [micAvailable, setMicAvailable] = useState<boolean>(false);

  const avatarRef = useRef<StreamingAvatar | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const autoSendTimerRef = useRef<number | null>(null);

  // simple speak queue so lines do not overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  function enqueueToSpeak(text: string) {
    const t = (text || '').trim();
    if (!t) return;
    speakQueueRef.current.push(t);
    drainSpeakQueue().catch(() => {});
  }

  async function drainSpeakQueue() {
    const a = avatarRef.current;
    if (!a) return;
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length) {
        const next = speakQueueRef.current.shift();
        if (!next) continue;
        await a.speak({ text: next, task_type: TaskType.REPEAT } as any);
        setCaptions((prev) => [...prev.slice(-10), next]);
      }
    } finally {
      speakingRef.current = false;
    }
  }

  // Detect mic + web speech support
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setMicAvailable(true);
      setMicStatus('idle');
    } else {
      setMicAvailable(false);
      setMicStatus('unsupported');
    }
  }, []);

  async function start() {
    try {
      setStatus('starting');
      setMsg('Starting Retell chat session…');

      // 1) start a Retell CHAT session (no audio)
      const r1 = await fetch('/api/retell-chat/start', { method: 'POST' });
      if (!r1.ok) throw new Error('Chat start failed');
      const { chat_id } = await r1.json();
      setChatId(chat_id);

      // 2) get HeyGen token and start avatar
      setMsg('Starting HeyGen avatar…');
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
      setMsg('Live! Speak or type in the chat box; Graham will speak the agent’s reply.');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  async function sendTextToAgent(text: string) {
    if (!chatId || !avatarRef.current) return;
    if (!text.trim()) return;

    const r = await fetch('/api/retell-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, content: text })
    });

    const data = await r.json();
    const agentText = (data?.text || '').trim();
    if (agentText) {
      enqueueToSpeak(agentText);
      await drainSpeakQueue();
    }
  }

  // Chat form handler (typing)
  async function sendChat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const userText = String(fd.get('chat') || '').trim();
    if (!userText) return;
    await sendTextToAgent(userText);
    (e.currentTarget.querySelector('input[name="chat"]') as HTMLInputElement).value = '';
  }

  // ===== Mic (Web Speech API) =====
  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'en-US';         // you can set to 'en-AU' if you prefer
    rec.interimResults = true;  // get streaming partials
    rec.continuous = true;      // keep listening until stopped
    rec.maxAlternatives = 1;
    return rec;
  }

  function startMic() {
    if (micStatus === 'unsupported') return;
    if (micStatus === 'listening') return;

    // ask browser for mic permission explicitly (helps UX)
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        const rec = initRecognition();
        if (!rec) { setMicStatus('unsupported'); return; }

        setInterim('');
        setFinalText('');
        recognitionRef.current = rec;

        rec.onresult = (evt: any) => {
          let interimAgg = '';
          let finalAgg = '';
          for (let i = evt.resultIndex; i < evt.results.length; i++) {
            const res = evt.results[i];
            const txt = res[0]?.transcript || '';
            if (res.isFinal) {
              finalAgg += txt + ' ';
            } else {
              interimAgg += txt + ' ';
            }
          }
          setInterim(interimAgg.trim());
          if (finalAgg.trim()) {
            const clean = finalAgg.trim();
            setFinalText((prev) => (prev ? prev + ' ' + clean : clean));

            // auto-send a moment after the user stops talking
            if (autoSendTimerRef.current) window.clearTimeout(autoSendTimerRef.current);
            autoSendTimerRef.current = window.setTimeout(async () => {
              const send = (prevFinal: string, currentInterim: string) =>
                (prevFinal + ' ' + currentInterim).trim();

              // Use the last known values at this moment
              setFinalText((prev) => {
                const payload = send(prev, '');
                if (payload) void sendTextToAgent(payload);
                return ''; // clear after sending
              });
              setInterim('');
            }, 650);
          }
        };

        rec.onerror = (e: any) => {
          console.warn('speech error', e?.error);
        };
        rec.onend = () => {
          setMicStatus('idle');
        };

        rec.start();
        setMicStatus('listening');
      })
      .catch(() => {
        setMicStatus('unsupported');
      });
  }

  function stopMic() {
    const rec = recognitionRef.current;
    if (rec) {
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (autoSendTimerRef.current) {
      window.clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    // if there’s any leftover interim/final, send it
    const leftover = (finalText + ' ' + interim).trim();
    setInterim('');
    setFinalText('');
    if (leftover) void sendTextToAgent(leftover);
    setMicStatus('idle');
  }

  const micButtonLabel =
    micStatus === 'unsupported' ? 'Mic not supported' :
    micStatus === 'listening' ? 'Stop Mic' :
    'Start Mic';

  const micButtonDisabled = micStatus === 'unsupported' || status !== 'ready';

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Graham — Voice & Chat → Retell Chat → HeyGen</h1>
      <p>Status: <b>{status}</b></p>
      <p>{msg}</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={start}
          style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}
          disabled={status === 'starting'}
        >
          Start
        </button>

        <form onSubmit={sendChat} style={{ display: 'flex', gap: 6 }}>
          <input
            name="chat"
            placeholder="Type a message for the agent"
            style={{ padding: 8, borderRadius: 6, width: 360 }}
            disabled={status !== 'ready'}
          />
          <button type="submit" style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }} disabled={status !== 'ready'}>
            Send
          </button>
        </form>

        <button
          onClick={micStatus === 'listening' ? stopMic : startMic}
          style={{ padding: '10px 16px', borderRadius: 8, cursor: micButtonDisabled ? 'not-allowed' : 'pointer' }}
          disabled={micButtonDisabled}
          title={micAvailable ? '' : 'Use Chrome/Edge for mic transcription'}
        >
          {micButtonLabel}
        </button>
      </div>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9', background: '#000', borderRadius: 12 }}
      />

      {/* Captions – exactly what we send to HeyGen */}
      <div
        style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 10,
          background: '#111', color: '#fff', lineHeight: 1.5, fontSize: 16, maxWidth: 860
        }}
      >
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Agent captions</div>
        {captions.length === 0 ? (
          <div style={{ opacity: 0.6 }}>…waiting</div>
        ) : (
          captions.map((c, i) => (<div key={i} style={{ margin: '4px 0' }}>• {c}</div>))
        )}
      </div>

      {/* Mic debug panel */}
      <div
        style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 10,
          border: '1px solid #333', background: '#0b0b0b', color: '#d4f0ff',
          maxWidth: 860, fontSize: 13
        }}
      >
        <div><b>Mic:</b> {micStatus}</div>
        {!!interim && (
          <div><b>Interim:</b> <span style={{ color: '#fff' }}>{interim}</span></div>
        )}
        {!!finalText && (
          <div><b>Final (queued):</b> <span style={{ color: '#fff' }}>{finalText}</span></div>
        )}
        {micStatus === 'unsupported' && (
          <div style={{ color: '#fca5a5' }}>
            Your browser doesn’t support the Web Speech API. Use Chrome/Edge, or I can wire a server STT later.
          </div>
        )}
      </div>
    </main>
  );
}
