'use client';
import React, { useState } from 'react';
import AvatarChatPanel from './AvatarChatPanel';

export default function ChatFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button */}
      <button onClick={()=>setOpen(true)} style={fab}>
        <span style={{fontWeight:700}}>Chat</span>
      </button>

      {/* Modal */}
      {open && (
        <div style={backdrop} onClick={()=>setOpen(false)}>
          <div style={sheet} onClick={(e)=>e.stopPropagation()}>
            <AvatarChatPanel onClose={()=>setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

const fab = {
  position:'fixed', right:20, bottom:20, zIndex:50,
  background:'#1e90ff', color:'#fff', border:'none',
  borderRadius: 999, padding:'12px 18px', boxShadow:'0 10px 24px rgba(30,144,255,.35)',
  cursor:'pointer'
};

const backdrop = {
  position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:40,
  display:'grid', placeItems:'end', padding:16
};

const sheet = {
  width: 440, maxWidth:'min(92vw, 520px)'
};
