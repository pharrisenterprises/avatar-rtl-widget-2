// app/api/retell-chat/start/route.js
export async function POST() {
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.RETELL_AGENT_ID;
  if (!apiKey || !agentId) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing RETELL_API_KEY or RETELL_AGENT_ID' }), { status: 500 });
  }

  try {
    const r = await fetch('https://api.retellai.com/v2/chat/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ agent_id: agentId })
    });

    const j = await r.json();
    // Normalize field names:
    const chatId = j.chatId || j.chat_id || j.id || j.session_id || null;
    return new Response(JSON.stringify({ ok: r.ok, chatId, raw: j }), { status: r.ok ? 200 : 400 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'retell start failed' }), { status: 500 });
  }
}

// Convenience: GET does the same as POST so you can test in a tab
export const GET = POST;
