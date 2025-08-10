'use client';

import { useEffect, useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';

export default function AvatarBridge() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar.');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);
  const [captions, setCaptions] = useState<string[]>([]);
  const [debug, setDebug] = useState<string>('—');

  // Rolling full agent text this turn + how much we've already spoken
  const agentFullRef = useRef<string>('');
  const spokenIdxRef = useRef<number>(0);
  const idleTimerRef = useRef<number | null>(null);

  // Queue to avoid overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  // ---- HARD SILENCE for anything that isn't our HeyGen video ----
  useEffect(() => {
    // Mark our video so we allow it to play with audio
    if (videoRef.current) {
      (videoRef.current as any).dataset.allowPlay = '1';
    }

    // Monkey-patch HTMLMediaElement.play so unexpected elements are forced muted
    const origPlay = (HTMLMediaElement.prototype as any).play;
    const patchedPlay = function (this: HTMLMediaElement, ...args: any[]) {
      const allow = (this as any).dataset && (this as any).dataset.allowPlay === '1';
      if (!allow) {
        try { this.muted = true; this.volume = 0; } catch {}
      }
      try {
        const p = origPlay.apply(this, args);
        // Swallow autoplay errors for silenced elements
        if (p && typeof p.catch === 'function') return p.catch(() => undefined);
        return p;
      } catch {
        return Promise.resolve();
      }
    };
    (HTMLMediaElement.prototype as any).play = patchedPlay;

    // Keep smashing volume down on any new <audio>/<video> except our own
    const smash = () => {
      const ours = videoRef.current;
      document.querySelectorAll('audio, video').forEach((el) => {
        const m = el as HTMLMediaElement;
        const allow = (m as any).dataset && (m as any).dataset.allowPlay === '1';
        if (!allow || (ours && m !== ours)) {
          try { m.muted = true; m.volume = 0; m.pause?.(); } catch {}
        }
      });
    };
    const mo = new MutationObserver(smash);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    const interval = window.setInterval(smash, 500);

    return () => {
      (HTMLMediaElement.prototype as any).play = origPlay;
      mo.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  // ---- HeyGen speak helpers ----
  async function safeSpeak(a: StreamingAvatar, text: string) {
    const t = text.trim();
    if (!t) return;
    try {
      await a.speak({ text: t, task_type: TaskType.REPEAT } as any);
      setCaptions((prev) => [...prev.slice(-10), t]);
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
    const t = text.trim();
    if (!t) return;
    speakQueueRef.current.push(t);
    if (avatar) void drainSpeakQueue(avatar);
  }

  // ---- Retell text extraction (deep + robust) ----
  function isUserRole(o: any): boolean {
    const role = (o?.role || o?.speaker || o?.source || o?.who || '').toString().toLowerCase();
    return role.includes('user');
  }

  // Recursively collect candidate strings from keys we care about
  function deepCollectAgentStrings(o: any, seen: Set<any>, path: string[] = [], acc: string[] = []): string[] {
    if (!o || typeof o !== 'object' || seen.has(o)) return acc;
    seen.add(o);

    // If this object itself declares a user role, skip its subtree
    if (isUserRole(o)) return acc;

    const keys = Object.keys(o);
    for (const k of keys) {
      const v: any = (o as any)[k];
      const newPath = [...path, k];

      // If key looks texty
      if (typeof v === 'string' && /text|transcript|content|message/i.test(k)) {
        const s = v.trim();
        if (s) acc.push(s);
      }

      // transcript arrays
      if (Array.isArray(v) && /transcript/i.test(k)) {
        for (const item of v) {
          if (item && typeof item === 'object' && !isUserRole(item)) {
            const x = (item.text || item.transcript || item.content || item.message || '').toString().trim();
            if (x) acc.push(x);
          }
        }
      }

      // Recurse objects and arrays
      if (v && typeof v === 'object') {
        deepCollectAgentStrings(v, seen, newPath, acc);
      }
    }
    return acc;
  }

  // From a big blob of agent strings, build a single normalized "full" text
  function normalizeAgentFull(candidates: string[]): string {
    if (candidates.length === 0) return '';
    // take the longest candidate (usually the whole turn), fallback to join
    const longest = candidates.reduce((a, b) => (a.length >= b.length ? a : b), '');
    const joined = candidates.join(' ');
    const full = (longest.length > joined.length ? longest : joined).replace(/\s+/g, ' ').trim();
    return full;
  }

  function splitCompletedSince(lastIdx: number, full: string) {
    const newChunk = full.slice(lastIdx);
    if (!newChunk) return { completed: [] as string[], consumed: 0 };
    // sentence enders . ! ? … with optional closing quotes/paren + trailing spaces
    const re = /[^.!?…]+[.!?…]+["')]*\s*/g;
    const completed: string[] = [];
    let consumed = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(newChunk)) !== null) {
      completed.push(m[0].trim());
      consumed = m.index + m[0].length;
    }
    return { completed, consumed };
  }

  function tryFlushTail(forceFinal: boolean) {
    const full = agentFullRef.current;
    const last = spokenIdxRef.current;
    if (full.length <= last) return;

    const { completed, consumed } = splitCompletedSince(last, full);
    if (completed.length) {
      spokenIdxRef.current = last + consumed;
      completed.forEach((s) => enqueueToSpeak(s));
    }
    if (forceFinal && spokenIdxRef.current < full.length) {
      const tail = full.slice(spokenIdxRef.current).trim();
      if (tail) {
        spokenIdxRef.current = full.length;
        enqueueToSpeak(tail);
      }
    }
  }

  function handleRetell
