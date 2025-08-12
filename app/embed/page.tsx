// app/embed/page.jsx
'use client';

import { useEffect, useState } from 'react';

const BG = '#000';

export default function Embed() {
  const [status, setStatus] = useState('booting');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const health = await fetch('/api/health', { cache: 'no-store' }).then(r => r.json());
        if (!health.ok) {
          setStatus('error');
          setErr(
            `Health fail → hasKey=${health.hasKey} using=${health.using} `
            + `avatarId=${health.avatarId} avatarName=${health.avatarName} voiceId=${health.voiceId}`
          );
          return;
        }
        setStatus('ready');

        // NOTE:
        // This page is intentionally lightweight. It exists to *never* show a blank screen
        // and to surface exactly what's missing if envs are wrong. Your real player logic
        // can be (re)inserted here when you’re ready; the health gate ensures inputs are valid.
      } catch (e) {
        setStatus('error');
        setErr(String(e));
      }
    })();
  }, []);

  return (
    <div
      style={{
        position: 'absolute', inset: 0, background: BG, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif', padding: 16
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 320, height: 180,
            background: 'radial-gradient(100% 120% at 0% 0%, rgba(255,255,255,0.06), rgba(0,0,0,0))',
            borderRadius: 12, margin: '0 auto 16px auto',
            border: '1px solid rgba(255,255,255,.1)'
          }}
        />
        <div style={{ fontSize: 14, opacity: 0.8, marginBottom: 6 }}>Status: {status}</div>
        {err && (
          <div style={{ color: '#ff6b6b', fontSize: 12, maxWidth: 360, whiteSpace: 'pre-wrap' }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
