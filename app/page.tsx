'use client';

import { useState } from 'react';

type Avatar = { id: string; name: string; thumb?: string | null };

export default function Home() {
  const [status, setStatus] = useState<'Idle'|'Running'|'Done'|'Error'>('Idle');
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [query, setQuery] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [log, setLog] = useState<any>({});

  async function loadAvatars() {
    setStatus('Running');
    const r = await fetch(`/api/heygen-avatars?q=${encodeURIComponent(query)}&limit=32`);
    const j = await r.json();
    if (!r.ok || !j?.ok) {
      setStatus('Error');
      setLog((l:any) => ({ ...l, avatarsError: j }));
      return;
    }
    setAvatars(j.avatars || []);
    if (!avatarId && j.avatars?.length) setAvatarId(j.avatars[0].id);
    setStatus('Idle');
  }

  async function runChecks() {
    setStatus('Running');
    try {
      const getRetell = await brief('/api/retell-token');
      const getHeygen = await brief('/api/heygen-session');

      const postRetell = await brief('/api/retell-token', { method: 'POST' });

      const postHeygen = await brief('/api/heygen-session', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(avatarId ? { avatarId } : {}) // if not set, server uses env default
      });

      setLog({ usedAvatarId: avatarId || '(env default)', getRetell, getHeygen, postRetell, postHeygen });
      setStatus('Done');
    } catch (e:any) {
      setStatus('Error');
      setLog({ fatal: String(e?.message || e) });
    }
  }

  return (
    <main style={{minHeight:'100vh',display:'grid',placeItems:'center',gap:16,padding:24,fontFamily:'system-ui'}}>
      <h1>Avatar Widget • Setup Check</h1>

      <section style={{display:'grid',gap:10, width:'min(960px,95vw)'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search avatars (e.g., Ilia)" style={input}/>
          <button onClick={loadAvatars} style={btn}>Load avatars</button>
        </div>

        {!!avatars.length && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10, maxHeight:320, overflow:'auto'}}>
            {avatars.map(a => (
              <div key={a.id} style={{border:'1px solid #ddd',borderRadius:8,padding:10,display:'grid',gap:8}}>
                {a.thumb ? <img src={a.thumb} alt={a.name} style={{width:'100%',borderRadius:6}}/> : null}
                <div style={{fontWeight:600}}>{a.name}</div>
                <code style={{fontSize:12,opacity:.8}}>{a.id}</code>
                <button onClick={()=>setAvatarId(a.id)}
                        style={{...btn, background: avatarId===a.id ? '#111827' : '#e5e7eb', color: avatarId===a.id ? '#fff' : '#111'}}>
                  {avatarId===a.id ? 'Selected' : 'Use this'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{opacity:.7,fontSize:14}}>
          Current avatarId: <code>{avatarId || '(env default)'}</code>
        </div>
      </section>

      <button onClick={runChecks} style={btn}>Run API checks</button>
      <div>Status: <strong>{status}</strong></div>

      <pre style={pre}>{JSON.stringify(log, null, 2)}</pre>

      <p style={{opacity:.7,fontSize:14,maxWidth:900,textAlign:'center'}}>
        Success = Retell POST returns <code>access_token</code> & HeyGen POST returns session info (token + URL or player_url).
      </p>
    </main>
  );
}

const btn: React.CSSProperties = { padding:'10px 16px', cursor:'pointer', background:'#111827', color:'#fff', border:'none', borderRadius:8 };
const input: React.CSSProperties = { padding:'8px 10px', border:'1px solid #ccc', borderRadius:6, minWidth:260 };
const pre: React.CSSProperties = { textAlign:'left', width:'min(980px,95vw)', whiteSpace:'pre-wrap', wordBreak:'break-word', background:'#0b0b0b', color:'#00ff87', padding:16, borderRadius:10 };

async function brief(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  let json: any = undefined; try { json = JSON.parse(text); } catch {}
  // redact tokens if present
  if (json?.access_token) json.access_token = '***';
  if (json?.data?.access_token) json.data.access_token = '***';
  return { ok: res.ok, status: res.status, contentType: ct, endpoint: url, json: summarize(json) };
}

function summarize(j: any) {
  if (!j) return j;
  const copy = JSON.parse(JSON.stringify(j));
  if (Array.isArray(copy?.avatars)) copy.avatars = `[${copy.avatars.length} items]`;
  if (Array.isArray(copy?.data)) copy.data = `[${copy.data.length} items]`;
  return copy;
}

