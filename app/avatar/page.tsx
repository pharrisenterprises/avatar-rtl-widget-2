'use client';

import { useRef, useState } from 'react';
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
      }
    } finally {
      speakingRef.current = false;
    }
  }

  async function start() {
    try {
      setStatus('starting');
      setMsg('Requesting tokens...');

      // Retell web-call access token
      const retellRes = await fetch('/api/retell-webcall', { method: 'POST' });
      if (!retellRes.ok) throw new Error('Retell token failed: ' + retellRes.status);
      const { access_token } = await retellRes.json();

      // Start Retell call
      const retell = new RetellWebClient();
      await retell.startCall({ accessToken: access_token });

      // HeyGen session token
      const heygenRes = await fetch('/api/heygen-token', { method: 'POST' });
      if (!heygenRes.ok) throw new Error('HeyGen token failed: ' + heygenRes.status);
      const { token } = await heygenRes.json();

      // Init HeyGen avatar
      const a = new StreamingAvatar({ token });
      a.on(StreamingEvents.STREAM_READY, (evt: any) => {
        const stream: MediaStream = evt.detail;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });

      // Build options object in a TS-friendly way
      const voiceId = process.env.NEXT_PUBLIC_HEYGEN_VOICE_ID || '';
      const avatarName = process.env.NEXT_PUBLIC_H
