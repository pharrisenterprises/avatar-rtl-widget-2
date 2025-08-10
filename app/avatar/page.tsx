'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [captions, setCaptions] = useState<string[]>([]);
  const [debug, setDebug] = useState<string>('—');

  // Rolling full agent text for current turn
  const agentFullRef = useRef<string>('');
  // Char index already spoken
  const spokenIdxRef = useRef<number>(0);
  // Debounce flush timer
  const idleTimerRef = useRef<number | null>(null);

  // Speak queue to avoid overlaps
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // ---------- Mute everything except our HeyGen <video> ----------
  function hardMuteNonAvatarMedia() {
    const av = videoRef.current;
    const medias = document.querySelectorAll('audio, video');
    medias.forEach((el) => {
      const m = el as HTMLMediaElement;
      if (av && m === av) {
        // keep HeyGen audible
        m.muted = false;
        m.volume = 1;
      } else {
        try { m.muted = true; m.volume = 0; } catch {}
      }
    });
  }
  useEffect(() => {
    const mo = new MutationObserver(() => hardMuteNonAvatarMedia());
    mo.observe(document.documentElement, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  // ---------- HeyGen speaking helpers ----------
  async function safeSpeak(a: StreamingAvatar, text: string) {
    const t = text.trim();
    if (!t) return;
    try {
      await a.speak({ text: t, task_type: TaskType.REPEAT } as any);
      setCaptions(prev => [...prev.slice(-10), t]);
    } catch (err) {
      console.error('[HeyGen] speak failed:', err);
      setMsg('Error: speak() failed. See console.');
    }
  }
  async function drainSpeakQueue(a: StreamingAvatar) {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length > 0) {
        const chunk = speakQueueRef.current.shift();
        if (!chunk) break;
        await safeSpeak(a, chunk);
      }
    } finally {
      speakingRef.current = false;
    }
  }
  function enqueueToSpeak(text: string) {
    if (!text.trim()) return;
    speakQueueRef.current.push(text.trim());
    if (avatar) void drainSpeakQueue(avatar);
  }

  // ---------- Retell transcript handling (sentence-based) ----------
  function isUserRole(x: any): boolean {
    const role = (x?.role || x?.speaker || x?.source || x?.who || '').toString().toLowerCase();
    return role.includes('user');
  }
  function extractLooseText(x: any): string | null {
    const t = x?.text ?? x?.transcript ?? x?.content ?? x?.message ?? null;
    return typeof t === 'string' && t.trim() ? t.trim() : null;
  }

  // Robust agent text extractor for many Retell shapes
  function extractAgentFromUpdate(update: any): string | null {
    const seen: string[] = [];

    // 1) transcript array (rolling)
    if (Array.isArray(update?.transcript)) {
      seen.push('transcript[]');
      const arr = update.transcript as TranscriptItem[];
      // build only agent lines
      const agentLines = arr
        .filter(item => !isUserRole(item))
        .map(extractLooseText)
        .filter((t): t is string => !!t);
      if (agentLines.length) {
        setDebug(seen.join(' → '));
        return agentLines.join(' ').replace(/\s+/g, ' ').trim();
      }
    }

    // 2) agent_response.content
    const arContent = update?.agent_response?.content;
    if (typeof arContent === 'string' && arContent.trim()) {
      seen.push('agent_response.content');
      setDebug(seen.join(' → '));
      return arContent.trim();
    }

    // 3) agent_message.text/content
    const am = update?.agent_message;
    const amText = extractLooseText(am);
    if (amText) {
      seen.push('agent_message');
      setDebug(seen.join(' → '));
      return amText;
    }

    // 4) message with role assistant
    const msgObj = update?.message;
    if (msgObj && (msgObj.role === 'assistant' || msgObj.role === 'agent')) {
      const mText = extractLooseText(msgObj);
      if (mText) {
        seen.push('message(role=assistant/agent)');
        setDebug(seen.join(' → '));
        return mText;
      }
    }

    // 5) top-level text-like fields
    const loose = extractLooseText(update);
    if (loose) {
      seen.push('top-level(text)');
      setDebug(seen.join(' → '));
      return loose;
    }

    // nothing found
    setDebug('no-agent-text');
    return null;
  }

  function splitCompletedSince(lastIdx: number, full: string) {
    const newChunk = full.slice(lastIdx);
    if (!newChunk) return { completed: [] as string[], consumed: 0 };
    // sentence ends: . ! ? … with optional closing quotes/paren
    const regex = /[^.!?…]+[.!?…]+["')]*\s*/g;
    const completed: string[] = [];
    let consumed = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(newChunk)) !== null) {
      completed.push(match[0].trim());
      consumed = match.index + match[0].length;
    }
    return { completed, consumed };
  }

  function tryFlushTail(forceFinal: boolean) {
    const full = agentFullRef.current;
    const last = spokenIdxRef.current;

    if (full.length <= last) return;

    const { completed, consumed } = splitCompletedSince(last, full);
    if (completed.length > 0) {
      spokenIdxRef.current = last + consumed;
      completed.forEach(s => enqueueToSpeak(s));
    }
    if (forceFinal && spokenIdxRef.current < full.length) {
      const tail = full.slice(spokenIdxRef.current).trim();
      if (tail) {
        spokenIdxRef.current = full.length;
        enqueueToSpeak(tail);
      }
    }
  }

  function handleAnyUpdate(update: any) {
    const agentFull = extractAgentFromUpdate(update);
    if (!agentFull) return;

    // Normalize whitespace
    const full = agentFull.replace(/\s+/g, ' ').trim();
    if (!full) return;

    // Track the full rolling string for this turn
    agentFullRef.current = full;

    // Debounce flush if agent pauses
    if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      tryFlushTail(true);
    }, 1200);

    // Try to flush any newly completed sentences immediately
    tryFlushTail(false);
  }

  // ---------- Start flow ----------
  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // Retell web call
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      const retell = new RetellWebClient();
      await retell.startCall({ accessToken: access_token });
      console.log('[Retell] call started');

      hardMuteNonAvatarMedia(); // immediately silence Retell output

      // Listen for any update shape
      retell.on?.('update', (u: any) => {
        // console.log('[Retell] update', u);
        try { handleAnyUpdate(u); } catch (e) { console.error('[Bridge] parse update failed', e); }
      });
      retell.on?.('agent_start_talking', () => console.log('[Retell] agent_start_talking'));
      retell.on?.('agent_stop_talking', () => {
        console.log('[Retell] agent_stop_talking');
        tryFlushTail(true);
      });
      retell.on?.('error', (e: any) => console.error('[Retell] error', e));

      // HeyGen
      const heygenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!heygenRes.ok) throw new Error('HeyGen token failed: ' + heygenRes.status);
      const { token } = await heygenRes.json();

      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = false; // we want HeyGen audio
          videoRef.current.play().catch(() => {});
        }
        hardMuteNonAvatarMedia(); // keep Retell muted even if new tags appear
      });

      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';      // Shawn AU
      const avatarName = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || ''; // Graham_Chair_Sitting_public

      const opts: any = { quality: AvatarQuality.High };
      if (voiceId) opts.voice = { voiceId };
      if (avatarName) opts.avatarName = avatarName;

      await a.createStartAvatar(opts);

      setAvatar(a);
      setStatus('ready');
      setMsg('Live! Avatar mirrors the agent (sentences only).');

      // DO NOT auto-speak any greeting here.
      // We’ll only speak agent lines pushed by the bridge.
    } catch (e: any) {
      console.error(e);
      setStatus('error');
      setMsg('Error: ' + (e?.message || String(e)));
    }
  }

  // Manual test (still useful)
  async function sayTest() {
    if (!avatar) return;
    enqueueToSpeak('Manual test line. You should hear me and see my mouth move.');
    await drainSpeakQueue(avatar!);
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Retell x HeyGen Avatar Bridge - /avatar</h1>
      <p>Status: <strong>{status}</strong></p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={start} style={{ padding: '10px 16px', bor
