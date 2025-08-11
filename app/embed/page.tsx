'use client';

import { useEffect, useRef, useState } from 'react';

export default function EmbedCompact() {
  const iframeWrapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle');

  useEffect(() => {
    setStatus('ready');
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      {/* Video area (HeyGen Avatar lives inside this page, so just a placeholder bg) */}
      <div
        ref={iframeWrapRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, #111, #222)',
        }}
      >
        {/* If you render the actual HeyGen <video> here in your app, keep it 100%/100%. */}
        {/* This compact page acts as a simple, full-bleed surface for your avatar widget code. */}
      </div>

      {/* Top bar – minimal */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            pointerEvents: 'auto',
            padding: '4px 8px',
            borderRadius: 8,
            fontSize: 12,
            color: '#ddd',
            background: 'rgba(0,0,0,.35)',
            backdropFilter: 'blur(6px)',
          }}
        >
          Status: {status}
        </span>

        <button
          id="aiw-start"
          style={{
            pointerEvents: 'auto',
            marginLeft: 'auto',
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,.25)',
            background: 'rgba(0,0,0,.45)',
            color: '#fff',
            fontSize: 13,
            cursor: 'pointer',
            backdropFilter: 'blur(6px)',
          }}
        >
          Start Mic
        </button>
      </div>
    </div>
  );
}
