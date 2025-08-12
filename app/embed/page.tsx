// app/embed/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function EmbedDebug() {
  const [status, setStatus] = useState<'ready' | 'token_ok' | 'token_fail' | 'avatar_ok' | 'avatar_fail'>('ready');
  const [tokenPrefix, setTokenPrefix] = useState<string>('—');
  const [resolvedId, setResolvedId] = useState<string>('—');

  const AVATAR_ID = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_ID || ''; // will be empty unless you add NEXT_PUBLIC var
  const AVATAR_NAME = process.env.NEXT_PUBLIC_HEYGEN_AVATAR_NAME || '';

  async function testToken() {
    setStatus('ready');
    try {
      const r = await fetch('/api/heygen-token', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j?.ok && j?.token) {
        setTokenPrefix(String(j.token).slice(0, 12) + '…');
        setStatus('token_ok');
      } else {
        setStatus('token_fail');
      }
    } catch { setStatus('token_fail'); }
  }

  async function testAvatar() {
    setStatus('ready');
    try {
      // prefer a configured ID if you expose it as NEXT_PUBLIC
      if (AVATAR_ID) {
        setResolvedId(AVATAR_ID);
        setStatus('avatar_ok');
        return;
      }
      const name = AVATAR_NAME;
      if (!name) { setStatus('avatar_fail'); return; }

      const r = await fetch(`/api/heygen-avatars?name=${encodeURIComponent(name)}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j?.ok && j?.id) {
        setResolvedId(j.id);
        setStatus('avatar_ok');
      } else {
        setStatus('avatar_fail');
      }
    } catch { setStatus('avatar_fail'); }
  }

  useEffect(() => {
    // automatically try token on load, then avatar
    testToken().then(() => testAvatar());
  }, []);

  return (
    <div style={{ padding: 20, color: '#fff', background: '#000', minHeight: '100vh' }}>
      <h2>Embed Debug</h2>
      <p>Status: {status}</p>

      <div style={{ display: 'flex', gap: 12, margin: '12px 0' }}>
        <button onClick={testAvatar} style={{ padding: '10px 16px' }}>Test Avatar</button>
        <button onClick={testToken} style={{ padding: '10px 16px' }}>Test Token</button>
      </div>

      <p>Resolved avatarId: {resolvedId}</p>
      <p>Token (prefix): {tokenPrefix}</p>
      <hr style={{ opacity: .2, margin: '16px 0' }} />
      <p>AVATAR_NAME: {AVATAR_NAME || '—'}</p>
    </div>
  );
}
