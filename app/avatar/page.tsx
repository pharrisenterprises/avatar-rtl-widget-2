'use client';

import { useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';
type TranscriptItem = { role?: string; speaker?: string; source?: string; who?: string; text?: string; transcript?: string; content?: string; message?: string };

export default function AvatarBridge() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  // Captions (what we send to HeyGen)
  const [captions, setCaptions] = useState<string[]>([]);

  // For deduping: remember last agent line we spoke
  const lastAgentLineRef = useRef<string>('');

  // Queue so avatar lines don't overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // ---- speaking helpers ----
  async function safeSpeak(a: StreamingAvatar, text: string) {
    try {
      console.log('[HeyGen] speak() try:', text);
      // Repeat mode = use our text exactly
      await a.speak({ text, task_type: TaskType.REPEAT } as any);
      setCaptions(prev => [...prev.slice(-8), text]);
      console.log('[HeyGen] speak() ok');
    } catch (err) {
      console.error('[HeyGen] speak() failed:', err);
      setMsg('Error: speak() failed. See console.');
    }
  }

  async function drainSpeakQueue(a: StreamingAvatar) {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length > 0) {
        const text = speakQueueRef.current.shift();
        if (!text) break;
        await safeSpeak(a, text);
      }
    } finally {
      speakingRef.current = false;
    }
  }

  function enqueue(text: string) {
    const t = text.trim();
    if (!t) return;
    if (t === lastAgentLineRef.current) return; // avoid repeats
    lastAgentLineRef.current = t;
    console.log('[Bridge] enqueue agent line:', t);
    speakQueueRef.current.push(t);
    if (avatar) void drainSpeakQueue(avatar);
  }

  // Pull agent text from a transcript item / update payload
  function extractText(x: any): string | null {
    const roleRaw = (x?.role || x?.speaker || x?.source || x?.who || '').toString().toLowerCase();
    if (roleRaw.includes('user')) return null;
    const text = x?.text ?? x?.transcript ?? x?.content ?? x?.message ?? null;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  }

  // Given update.transcript (array of last few sentences), take the latest agent sentence
  function handleTranscriptUpdate(update: any) {
    const arr = Array.isArray(update?.transcript) ? (update.transcript as TranscriptItem[]) : [];
    if (!arr.length) return;

    // Find the last item whose role is not user, then extract text
    for (let i = arr.length - 1; i >= 0; i--) {
      const text = extractText(arr[i]);
      if (text) {
        enqueue(text);
        break;
      }
    }
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // 1) Retell (web call)
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      const retell = new RetellWebClient();
      await retell.startCall({
        accessToken: access_token,
        // Optionally set sampleRate/playback/capture devices here
        // emitRawAudioSamples: false,
      });
      console.log('[Retell] call started');

      // The Retell doc says transcript is on `update.transcript` (rolling window). We use that.
      retell.on?.('update', (u: any) => {
        console.log('[Retell] update', u);
        handleTranscriptUpdate(u);
      });

      // Helpful logs; some SDKs also fire these but they don’t carry text
      retell.on?.('agent_start_talking', (e: any) => console.log('[Retell] agent_start_talking', e));
      retell.on?.('agent_stop_talking', (e: any) => console.log('[Retell] agent_stop_talking', e));
      retell.on?.('error', (e: any) => console.error('[Retell] error', e));

      // 2) HeyGen session + video
      const heygenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!heygenRes.ok) throw new Error('HeyGen token failed: ' + heygenRes.status);
      const { token } = await heygenRes.json();

      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // unmute now that we had a click (user gesture)
          videoRef.current.muted = false;
          videoRef.current.play().catch(() => {});
        }
        console.log('[HeyGen] stream ready');
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';      // AU male voice id
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || ''; // e.g. Graham_Chair_Sitting_public

      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);
      console.log('[HeyGen] avatar session started with', opts);

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! The avatar will mirror Retell replies.');

      // Drain any queued lines that came in before avatar was ready
      void drainSpeakQueue(a);

      // One forced line so you see/hear it immediately
      await safeSpeak(a, 'Lip sync link is live. I will mirror the agent.');
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  async function sayTest() {
    if (!avatar) return;
    await safeSpeak(avatar, 'This is a manual test line. The avatar should move its lips and you should hear me.');
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell x HeyGen Avatar Bridge - /avatar</h1>
      <p>Status: <strong>{status}</strong></p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
          Start
        </button>
        <button onClick={sayTest} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
          Say test line
        </button>
      </div>
      <p style={{ marginTop: 12 }}>{msg}</p>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        // do not hard-mute; we unmute in STREAM_READY
        style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9', background: '#000', borderRadius: 12, marginTop: 16 }}
      />

      {/* Captions (what we send to HeyGen) */}
      <div
        style={{
          marginTop: 12,
          padding: '12px 14px',
          borderRadius: 10,
          background: '#111',
          color: '#fff',
          lineHeight: 1.5,
          fontSize: 16,
          maxWidth: 860
        }}
      >
        <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>Agent captions</div>
        {captions.length === 0 ? (
          <div style={{ opacity: 0.6 }}>…waiting for agent</div>
        ) : (
          captions.map((c, i) => (
            <div key={i} style={{ margin: '4px 0' }}>• {c}</div>
          ))
        )}
      </div>
    </main>
  );
}:contentReference[oaicite:2]{index=2}
