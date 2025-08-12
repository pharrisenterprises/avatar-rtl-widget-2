// app/embed/page.jsx
'use client';
import { useEffect, useState } from 'react';

export default function EmbedDebug() {
  const [status, setStatus] = useState('ready');
  const [tokenPrefix, setTokenPrefix] = useState('—');
  const [resolvedId, setResolvedId] = useState('—');

  async function testToken() {
    setStatus('testing_token');
    try {
      const r = await fetch('/api/heygen-token', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j?.ok && j?.token) {
        setTokenPrefix(String(j.token).slice(0, 12) + '…');
        setStatus('token_ok');
      } else {
        setStatus('token_fail');
      }
    } catch {
      setStatus('token_fail');
    }
  }

  async function testAvatar() {
    setStatus('testing_avatar');
    try {
      // ask our API for the ID (it returns env ID if present)
      const r = await fetch('/api/heygen-avatars', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok && j?.ok && j?.id) {
        setResolvedId(j.id);
        setStatus('avatar_ok');
      } else {
        setStatus('avatar_fail');
      }
    } catch {
      setStatus('avatar_fail');
    }
  }

  useEffect(() => {
    (async () => {
      await testToken();
      await testAvatar();
    })();
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
    </div>
  );
}
