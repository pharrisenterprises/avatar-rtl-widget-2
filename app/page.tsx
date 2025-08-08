'use client';
import { useState } from 'react';

export default function Home() {
  const [output, setOutput] = useState<any>(null);
  const [status, setStatus] = useState('Idle');

  async function runChecks() {
    try {
      setStatus('Running...');
      // GET health checks
      const r1 = await fetch('/api/retell-token');
      const retellGET = await r1.json();
      const r2 = await fetch('/api/heygen-session');
      const heygenGET = await r2.json();

      // POST calls
      const p1 = await fetch('/api/retell-token', { method: 'POST' });
      const retellPOST = await p1.json();

      const p2 = await fetch('/api/heygen-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId:'default-avatar-1', voiceId:'default-voice-1' })
      });
      const heygenPOST = await p2.json();

      setOutput({ retellGET, heygenGET, retellPOST, heygenPOST });
      setStatus('Done');
    } catch (e:any) {
      setStatus('Error');
      setOutput({ error: e?.message || String(e) });
    }
  }

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',gap:16,fontFamily:'system-ui',padding:20}}>
      <h1>Avatar Widget Smoke Test</h1>
      <button onClick={runChecks} style={{padding:'10px 16px'}}>Run API checks</button>
      <div>Status: {status}</div>
      <pre style={{textAlign:'left',maxWidth:900,whiteSpace:'pre-wrap',wordBreak:'break-word',background:'#111',color:'#0f0',padding:16,borderRadius:8}}>
        {output ? JSON.stringify(output, null, 2) : 'No output yet.'}
      </pre>
      <p style={{opacity:.7,fontSize:14}}>This page verifies the two backend routes. Once both POST calls return tokens, we’ll swap this for the live mic + avatar page.</p>
    </main>
  );
}
