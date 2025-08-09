'use client';
import { useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('Click Start to test the avatar.');
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);

  async function start() {
    try {
      setStatus('loading');
      setMsg('Requesting HeyGen session…');
      setPlayerUrl(null);

      const r = await fetch('/api/heygen-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!r.ok) {
        const text = await r.text();
        setStatus('error');
        setMsg(`API error ${r.status}: ${text.slice(0,200)}`);
        return;
      }

      const data = await r.json();

      if (data.player_url) {
        setPlayerUrl(data.player_url);
        setStatus('ok');
        setMsg('Connected! Your avatar should be visible below.');
      } else {
        setStatus('ok');
        setMsg(`Got JSON without player_url. Keys: ${Object.keys(data).join(', ')}`);
        console.log('Session response:', data);
      }
    } catch (e:any) {
      setStatus('error');
      setMsg(`Unexpected error: ${e?.message || e}`);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 820, margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1>Avatar Start Test</h1>
      <p>Status: <b>{status}</b></p>
      <button onClick={start} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
        Start
      </button>
      <p style={{ marginTop: 12 }}>{msg}</p>

      {playerUrl && (
        <iframe
          title="HeyGen Player"
          src={playerUrl}
          style={{ width: '100%', height: 520, border: 0, marginTop: 16, borderRadius: 12 }}
          allow="microphone; camera; autoplay; clipboard-read; clipboard-write; encrypted-media;"
        />
      )}

      <div style={{ marginTop: 24 }}>
        <a href="/diagnostics">Go to diagnostics</a>
      </div>
    </main>
  );
}
