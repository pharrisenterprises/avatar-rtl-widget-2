'use client';

import { useState } from 'react';

type RespDump = {
  url: string;
  ok: boolean;
  status: number;
  contentType: string | null;
  text: string;
  json?: any;
  error?: string;
};

async function fetchDump(url: string, init?: RequestInit): Promise<RespDump> {
  const res = await fetch(url, init);
  const contentType = res.headers.get('content-type');
  const text = await res.text();
  let json: any = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON — that's fine, we’ll show raw text
  }
  return {
    url,
    ok: res.ok,
    status: res.status,
    contentType,
    text,
    json,
  };
}

export default function Home() {
  const [status, setStatus] = useState<'Idle'|'Running'|'Done'|'Error'>('Idle');
  const [out, setOut] = useState<any>(null);

  async function runChecks() {
    try {
      setStatus('Running');

      // GET health checks
      const getRetell = await fetchDump('/api/retell-token');
      const getHeygen = await fetchDump('/api/heygen-session');

      // POST calls
      const postRetell = await fetchDump('/api/retell-token', { method: 'POST' });
      const postHeygen = await fetchDump('/api/heygen-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId:'default-avatar-1', voiceId:'default-voice-1' }),
      });

      setOut({ getRetell, getHeygen, postRetell, postHeygen });
      setStatus('Done');
    } catch (e:any) {
      setStatus('Error');
      setOut({ fatal: String(e?.message || e) });
    }
  }

  return (
    <main style={{
      minHeight:'100vh', display:'grid', placeItems:'center', gap:24,
      fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      padding:24
    }}>
      <h1 style={{margin:0}}>Avatar Widget Diagnostics</h1>

      <button
        onClick={runChecks}
        style={{ padding:'12px 20px', cursor:'pointer', background:'#111827', color:'#fff',
                 border:'none', borderRadius:8, fontSize:16, boxShadow:'0 2px 8px rgba(0,0,0,.15)' }}
      >
        Run API checks
      </button>

      <div>Status: <strong>{status}</strong></div>

      <pre style={{
        textAlign:'left', width:'min(1000px, 92vw)', whiteSpace:'pre-wrap', wordBreak:'break-word',
        background:'#0b0b0b', color:'#00ff87', padding:16, borderRadius:10,
        boxShadow:'inset 0 0 0 1px rgba(255,255,255,.08)'
      }}>
        {out ? JSON.stringify(out, null, 2) : 'No output yet.'}
      </pre>

      <p style={{opacity:.7, fontSize:14, maxWidth:1000}}>
        • Both GETs should return <code>{"{ ok: true, route: ... }"}</code> as JSON.<br/>
        • The POST to <code>/api/retell-token</code> should return JSON with <code>access_token</code>.<br/>
        • The POST to <code>/api/heygen-session</code> should return JSON with <code>session_token</code> (and maybe <code>player_url</code>).<br/>
        If any call shows HTML, blank text, or non-200 status, we know exactly which route to fix.
      </p>
    </main>
  );
}
