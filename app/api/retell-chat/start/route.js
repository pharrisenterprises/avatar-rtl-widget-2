// app/api/retell-chat/start/route.js
import { NextResponse } from 'next/server';

const BASE = 'https://api.retellai.com';

export async function POST() {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { ok: false, error: 'Missing RETELL_API_KEY or RETELL_AGENT_ID' },
      { status: 500 }
    );
  }

  // Create a new chat tied to your agent
  const res = await fetch(`${BASE}/create-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      agent_id: agentId,
      // optional: system prompt / metadata can go here if you use them
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return NextResponse.json(
      { ok: false, error: `create-chat failed: ${res.status} ${t}` },
      { status: 502 }
    );
  }

  const j = await res.json();
  // Expect shape like { chat_id: '...' } (per Retell docs)
  return NextResponse.json({ ok: true, chatId: j.chat_id || j.id || null });
}
