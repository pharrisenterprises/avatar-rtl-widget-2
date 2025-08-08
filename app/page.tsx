'use client';

import { useState } from 'react';

type AnyJson = Record<string, any> | null;

export default function Home() {
  const [output, setOutput] = useState<AnyJson>(null);
  const [status, setStatus] = useState<'Idle' | 'Running' | 'Done' | 'Error'>('Idle');

  async function runChecks() {
    try {
      setStatus('Running');

      // --- GET health checks (verifies the routes exist) ---
      const retellGetRes = await fetch('/api/retell-token');
      const retellGET = await retellGetRes.json();
      const heygenGetRes = await fetch('/api/heygen-session');
      const heygenGET = await heygenGetRes.json();

      // --- POST calls (actual tokens) ---
      const retellPostRes = await fetch('/api/retell-token', { method: 'POST' });
      const retellPOST = await retellPostRes.json();

      const heygenPostRes = await fetch('/api/heygen-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: 'default-avatar-1', voiceId: 'default-voice-1' })
      });
      const heygenPOST = await heygenPostRes.json();

      setOutput({ retellGET, heygenGET, retellPOST, heygenPOST });
      setStatus('Done');
    } catch (e: any) {
      setStatus('Error');
      setOutput({ error: e?.message || String(e) });
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      gap: 24,
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      padding: 24
    }}>
      <h1 style={{ margin: 0 }}>Avatar Widget Smoke Test</h1>

      <button
        onClick={runChecks}
        style={{
          padding: '12px 20px',
          cursor: 'pointer',
          background: '#111827',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,.15)'
        }}
        aria-label="Run API checks"
      >
        Run API checks
      </button>

      <div style={{ fontSize: 16 }}>Status: <strong>{status}</strong></div>

      <pre style={{
        textAlign: 'left',
        width: 'min(900px, 90vw)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        background: '#0b0b0b',
        color: '#00ff87',
        padding: 16,
        borderRadius: 10,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)'
      }}>
        {output ? JSON.stringify(output, null, 2) : 'No output yet.'}
      </pre>

      <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 900, textAlign: 'center' }}>
        This page verifies your two backend routes. Expected results:
        <br />• <code>retellGET</code> → <code>{'{ ok: true, route: "retell-token" }'}</code>
        <br />• <code>heygenGET</code> → <code>{'{ ok: true, route: "heygen-session" }'}</code>
        <br />• <code>retellPOST</code> → includes <code>access_token</code>
        <br />• <code>heygenPOST</code> → includes <code>session_token</code> (maybe <code>player_url</code>)
      </p>
    </main>
  );
}
