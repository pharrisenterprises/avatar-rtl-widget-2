'use client';
import React, { useEffect, useRef, useState } from 'react';

export default function Embed() {
  const [status, setStatus] = useState<'loading'|'ready'|'error'>('loading');
  const startedRef = useRef(false);

  // Your existing Avatar UI imports/logic here:
  // assume you have startPreview() that starts HeyGen preview video (no mic)
  // and it renders the video element behind the overlay UI.

  async function startPreviewSafe() {
    if (startedRef.current) return;
    try {
      // TODO: call your existing start function that shows Graham silently
      // Example:
      // await heygen.start({ autoplay: true, muted: true });
      startedRef.current = true;
      setStatus('ready');
    } catch (e) {
      console.error('preview start failed', e);
      setStatus('error');
      startedRef.current = false;
    }
  }

  useEffect(() => {
    // Start preview as soon as the iframe loads (works on your Vercel test)
    startPreviewSafe();

    // Also listen for parent nudges coming from wordpress
    function onMsg(e: MessageEvent) {
      // Only trust your own parent origin
      if (e.origin !== 'https://pharrisenterprises-qjmtx.wpcomstaging.com' &&
          e.origin !== 'https://infinitysales.ai') return;

      const t = (e.data && (e.data as any).type) || '';
      if (t === 'aiw-wake' || t === 'aiw-open') startPreviewSafe();
    }
    window.addEventListener('message', onMsg);

    // Tell parent we're alive (useful for diagnostics)
    try { window.parent.postMessage({ type: 'aiw-ready' }, '*'); } catch(e){}

    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div style={{
      position:'absolute', inset:0, background:'#000',
      display:'flex', alignItems:'flex-start', justifyContent:'center'
    }}>
      {/* Place your existing avatar canvas/video underneath */}
      <div id="avatar-root" style={{position:'absolute', inset:0}} />
      {/* Minimal overlay just so we know state */}
      <div style={{
        position:'absolute', top:10, left:10,
        color:'#fff', font:'14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial'
      }}>
        <span>Status: {status}</span>
      </div>
      {/* Your Start Mic / Chat buttons live inside the iframe as before */}
    </div>
  );
}
