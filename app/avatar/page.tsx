'use client';

import { useRef, useState } from 'react';
import { RetellWebClient } from 'retell-client-js-sdk';
import StreamingAvatar, {
  StreamingEvents,
  TaskType,
  AvatarQuality,
} from '@heygen/streaming-avatar';

type Status = 'idle' | 'starting' | 'ready' | 'error';

export default function AvatarBridgeV4() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [msg, setMsg] = useState('Click Start to begin Retell + Avatar. (v4)');
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);
  const [retell, setRetell] = useState<RetellWebClient | null>(null);

  // Captions (finalized agent lines)
  const [captions, setCaptions] = useState<string[]>([]);
  const agentBufferRef = useRef<string>('');

  // Queue so avatar lines don't overlap
  const speakQueueRef = useRef<string[]>([]);
  const speakingRef = useRef<boolean>(false);

  async function drainSpeakQueue(a: StreamingAvatar) {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      while (speakQueueRef.current.length > 0) {
        const text = speakQueueRef.current.shift();
        if (!text) break;
        await a.speak({ text, task_type: TaskType.REPEAT });
        setCaptions(prev => [...prev.slice(-8), text]);
      }
    } finally {
      speakingRef.current = false;
    }
  }

  function extractAgentTextFromUpdate(evt: any): string | null {
    const role = evt?.role || evt?.speaker || evt?.source || evt?.who;
    if (role && String(role).toLowerCase().includes('user')) return null;
    const text = evt?.text ?? evt?.transcript ?? evt?.content ?? evt?.message ?? null;
    return typeof text === 'string' && text.trim() ? text : null;
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Creating Retell web call… (v4)');

      // Retell access token
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error(`Retell API ${retellRes.status}`);
      const { access_token } = await retellRes.json();

      // Start Retell call
      const retellClient = new RetellWebClient();
      await retellClient.startCall({ accessToken: access_token });
      setRetell(retellClient);

      retellClient.on?.('update', (evt: any) => {
        const t = extractAgentTextFromUpdate(evt);
        if (t) agentBufferRef.current = (agentBufferRef.current + ' ' + t).slice(-500);
      });

      retellClient.on?.('agent_stop_talking', (evt: any) => {
        const finalText =
          evt?.text || evt?.transcript || agentBufferRef.current.trim();
        agentBufferRef.current = '';
        if (finalText && avatar) {
          speakQueueRef.current.push(finalText);
          void drainSpeakQueue(avatar);
        }
      });

      setMsg('Starting HeyGen avatar session… (v4)');

      // HeyGen token
      const tokenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!tokenRes.ok) throw new Error(`HeyGen token API ${tokenRes.status}`);
      const { token } = await tokenRes.json();

      // Init HeyGen
      const a = new StreamingAvatar({ token });

      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (vide
