// app/api/retell-chat/send/route.js
import { NextResponse } from 'next/server';

const BASE = 'https://api.retellai.com';

// simple polling helper, keeps it server-side so the browser stays fast
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function POST(req) {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'Missing RETELL_API_KEY' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const { chatId, text } = body || {};
  if (!chatId || !text) {
    return NextResponse.json({ ok: false, error: 'chatId and text required' }, { status: 400 });
  }

  // 1) append user message
  const addRes = await fetch(`${BASE}/create-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      chat_id: chatId,
      role: 'user',
      content: text,
    }),
  });

  if (!addRes.ok) {
    const t = await addRes.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: `create-message failed: ${addRes.status} ${t}` },
      { status: 502 }
    );
  }

  // 2) poll chat until we see a new assistant message
  //    (lightweight + reliable; no streaming in the browser yet)
  let assistant = null;
  const started = Date.now();
  const timeoutMs = 25_000; // stop after ~25s
  const pollEveryMs = 800;

  let lastAssistantIndex = -1;

  while (Date.now() - started < timeoutMs) {
    const getRes = await fetch(`${BASE}/get-chat/${encodeURIComponent(chatId)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!getRes.ok) {
      const t = await getRes.text().catch(() => '');
      return NextResponse.json(
        { ok: false, error: `get-chat failed: ${getRes.status} ${t}` },
        { status: 502 }
      );
    }

    const data = await getRes.json();
    // Expect data.messages like [{role:'user'|'assistant', content:'...'}, ...]
    const msgs = Array.isArray(data?.messages) ? data.messages : [];

    const assistantMsgs = msgs.filter(m => (m.role || '').toLowerCase() === 'assistant');
    if (assistantMsgs.length > 0) {
      const idx = assistantMsgs.length - 1;
      if (idx !== lastAssistantIndex) {
        lastAssistantIndex = idx;
        assistant = assistantMsgs[idx]?.content || null;
        if (assistant) break;
      }
    }

    await sleep(pollEveryMs);
  }

  return NextResponse.json({ ok: true, reply: assistant || '' });
}
