'use client';

import React, { useRef, useState } from 'react';
import { loadHeygenSdk } from '../lib/loadHeygenSdk';

export default function AvatarPage() {
  const [status, setStatus] = useState('ready');
  const [note, setNote] = useState('');
  const videoRef = useRef(null);

  async function start() {
    try {
      setStatus('loading-sdk'); setNote('Loading HeyGen SDK…');
      const HeyGenCtor = await loadHeygenSdk();

      // 1) session token
      const tRes = await fetch('/api/heygen-token', { cache: 'no-store' });
      const tJson = await tRes.json();
      const token = tJson?.token;
      if (!token) throw new Error('Token missing from /api/heygen-token');

      // 2) avatar id
      const aRes = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const aJson = await aRes.json();
      const avatarName = aJson?.id;
      if (!avatarName) throw new Error('Avatar id missing from /api/heygen-avatars');

      window.__HEYGEN_DEBUG__ = { token, avatarName };

      setStatus('starting'); setNote(`Starting ${avatarName}…`);
      const client = new HeyGenCtor({ token });

      // v2+ shape (some builds accept version)
      const session = await (client.createStartAvatar?.({
        avatarName, quality: 'high', version: 'v3',
      }) ?? client.createStartAvatar?.({ avatarName, quality: 'high' }));

      // ---------- DIAGNOSTICS: print REAL keys ----------
      const ck = Object.keys(client || {});
      const sk = Object.keys(session || {});
      console.log('[DBG] client keys ->', ck.join(', '));
      console.log('[DBG] session keys ->', sk.join(', '));
      if (session) {
        // print sub-objects one level deep so we see where media hides
        for (const k of sk) {
          try {
            const v = session[k];
            const vk = v && typeof v === 'object' ? Object.keys(v) : [];
            console.log(`[DBG] session.${k} type=${typeof v} keys=${Array.isArray(vk)?vk.join(', '):''}`);
          } catch {}
        }
      }
      // ---------- END DIAGNOSTICS ----------

      const videoEl = videoRef.current;
      if (!videoEl) throw new Error('Missing <video> element');

      // 1) direct attach methods
      if (session && typeof session.attachToElement === 'function') {
        await session.attachToElement(videoEl); return done('session.attachToElement');
      }
      if (typeof client.attachToElement === 'function') {
        await client.attachToElement(videoEl); return done('client.attachToElement');
      }

      // 2) direct MediaStream on session/client
      const directStreams = [
        session?.mediaStream,
        session?.stream,
        client?.mediaStream,
        client?.stream,
      ].filter(Boolean);
      for (const ms of directStreams) {
        if (ms instanceof MediaStream) {
          videoEl.srcObject = ms; await videoEl.play(); return done('direct MediaStream');
        }
      }

      // 3) tracks on session (common)
      const vt = session?.videoTrack || session?.video || session?.cameraTrack;
      const at = session?.audioTrack || session?.audio || session?.microphoneTrack;
      const simpleTracks = [vt, at].filter(Boolean).map(x => (x?.track || x));
      if (simpleTracks.length) {
        const ms = new MediaStream(simpleTracks);
        videoEl.srcObject = ms; await videoEl.play(); return done('tracks on session');
      }

      // 4) getter helpers (some builds)
      for (const getter of ['getMediaStream', 'getStream', 'getOutputStream']) {
        if (typeof session?.[getter] === 'function') {
          const ms = await session[getter](); 
          if (ms instanceof MediaStream) { videoEl.srcObject = ms; await videoEl.play(); return done(`session.${getter}()`); }
        }
        if (typeof client?.[getter] === 'function') {
          const ms = await client[getter]();
          if (ms instanceof MediaStream) { videoEl.srcObject = ms; await videoEl.play(); return done(`client.${getter}()`); }
        }
      }

      // 5) DEEP SCAN for streams/tracks (catches hidden shapes, e.g. LiveKit wrappers)
      const msDeep = findMediaStreamDeep(session) || findMediaStreamDeep(client);
      if (msDeep) {
        videoEl.srcObject = msDeep; await videoEl.play(); return done('deep-scan');
      }

      console.log('[DBG] session dump:', session);
      console.log('[DBG] client dump:', client);
      throw new Error('No attach function or MediaStream available');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setNote(err?.message || 'start failed');
      alert(err?.message || 'Start failed');
    }

    function done(how) {
      console.log('[DBG] attached via:', how);
      setStatus('started'); setNote('Streaming!');
    }
  }

  return (
    <div style={{ padding: 20, color: '#fff', background: '#111', minHeight: '100vh', fontFamily: 'system-ui,sans-serif' }}>
      <h1>Avatar Debug (/avatar)</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>{note}</p>
      <button onClick={start} style={btn}>Start</button>
      <div style={{ marginTop: 20, width: 640, maxWidth: '100%', aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    </div>
  );
}

// ---- deep scanner utilities ----
function isMSTrack(x) {
  return x && (x.kind === 'video' || x.kind === 'audio') && typeof x.stop === 'function';
}
function toMsIfTrackish(x) {
  if (x instanceof MediaStream) return x;
  if (isMSTrack(x)) return new MediaStream([x]);
  if (x?.track && isMSTrack(x.track)) return new MediaStream([x.track]);
  return null;
}
function findMediaStreamDeep(root, maxDepth = 4) {
  try {
    const seen = new WeakSet();
    const q = [{ v: root, d: 0 }];
    const tracks = [];
    while (q.length) {
      const { v, d } = q.shift();
      if (!v || typeof v !== 'object' || seen.has(v)) continue;
      seen.add(v);

      // direct MS?
      if (v instanceof MediaStream) return v;

      // trackish?
      const ms = toMsIfTrackish(v);
      if (ms) return ms;

      // obvious fields
      for (const key of ['mediaStream', 'stream', 'videoTrack', 'audioTrack', 'cameraTrack', 'microphoneTrack']) {
        const val = v[key];
        const msv = toMsIfTrackish(val);
        if (msv) return msv;
      }

      // collect separate tracks to combine
      for (const key of Object.keys(v)) {
        const val = v[key];
        const maybeMs = toMsIfTrackish(val);
        if (maybeMs) return maybeMs;
        if (isMSTrack(val) || (val?.track && isMSTrack(val.track))) {
          tracks.push(val?.track || val);
        }
      }
      if (tracks.length >= 1) {
        return new MediaStream(tracks.map(t => t));
      }

      // BFS
      if (d < maxDepth) {
        for (const key of Object.keys(v)) {
          const val = v[key];
          if (val && typeof val === 'object') q.push({ v: val, d: d + 1 });
        }
      }
    }
  } catch {}
  return null;
}

// ---- styles ----
const btn = {
  padding: '10px 16px',
  borderRadius: 8,
  background: '#1e90ff',
  border: '1px solid #1e90ff',
  color: '#fff',
  cursor: 'pointer'
};
